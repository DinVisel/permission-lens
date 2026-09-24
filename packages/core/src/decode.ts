import { detect } from "./detect.js";
import { normalizeAuthorization } from "./authorization.js";
import { grantFrom7702Authorization } from "./grants/from-7702.js";
import { parse7702Transaction } from "./transaction.js";
import { parse7710TypedData } from "./delegation/parse-7710.js";
import { allRules } from "./rules/index.js";
import { runRules } from "./rules/runner.js";
import type { RuleContext } from "./rules/types.js";
import type { DecodeOptions, DecodeResult, Grant, GrantInput } from "./types.js";

export const REGISTRY_VERSION_UNSET = "unset";

/**
 * Decodes a `GrantInput` into the standard-neutral IR and runs every rule
 * whose required facts are present. Pure and offline — it never makes a
 * network call. Optional chain enrichment happens later, via
 * `@permissionlens/onchain`'s `enrich()`, which re-runs rules with more facts.
 *
 * Note on the plan's "sync" aspiration (IMPLEMENTATION_PLAN.md §5.4): this is
 * `async` because recovering the authority from a signature
 * (`viem`'s `recoverAddress`) is itself async.
 */
export async function decode(input: GrantInput, options: DecodeOptions = {}): Promise<DecodeResult> {
  const resolved = detect(input);
  const grants: Grant[] = [];
  const unsupportedReasons: string[] = [];

  for (const [index, item] of resolved.entries()) {
    const path = `[${index}]`;

    if (item.kind === "unsupported") {
      unsupportedReasons.push(item.reason);
      continue;
    }

    if (item.kind === "7702-authorization") {
      const normalized = normalizeAuthorization(item.authorization);
      const grant = await grantFrom7702Authorization(normalized, { path, input });
      applyRegistryFacts(grant, options);
      grants.push(grant);
      continue;
    }

    if (item.kind === "7702-transaction") {
      const parsed = await parse7702Transaction(item.serialized);
      for (const [tupleIndex, auth] of parsed.authorizations.entries()) {
        const grant = await grantFrom7702Authorization(auth, {
          path: `${path}.authorizationList[${tupleIndex}]`,
          input,
        });
        if (parsed.sender) {
          grant.facts.sender = parsed.sender;
          grant.facts.relayed = grant.grantor !== null && grant.grantor.toLowerCase() !== parsed.sender.toLowerCase();
        }
        applyRegistryFacts(grant, options);
        grants.push(grant);
      }
      continue;
    }

    if (item.kind === "7710-delegation") {
      const grant = parse7710TypedData(item.typedData, { registry: options.registry, chainId: options.chainId, input, path });
      applyDelegationManagerFacts(grant, options);
      grants.push(grant);
      continue;
    }

    if (item.kind === "raw-hash") {
      grants.push({
        id: item.hash,
        standard: "raw-hash",
        grantor: null,
        grantee: { type: "unknown" },
        chains: { type: "all" },
        scope: { type: "unknown" },
        validity: {},
        replay: {},
        revocation: { method: "Not applicable — no signature was produced by this decode step.", onchain: false },
        facts: {},
        source: { input, path },
      });
    }
  }

  const ctx: RuleContext = { chainId: options.chainId, registry: options.registry };
  const { findings, notChecked, checkedRuleIds } = runRules(grants, allRules, ctx);

  const result: DecodeResult = {
    specVersion: "1",
    grants,
    findings,
    notChecked,
    checkedRuleIds,
    registryVersion: options.registry ? (options.registryVersion ?? REGISTRY_VERSION_UNSET) : REGISTRY_VERSION_UNSET,
  };

  if (grants.length === 0 && unsupportedReasons.length > 0) {
    const reason = unsupportedReasons.join("; ");
    result.unsupported = { reason };
    // PL-GEN-003: not tied to any Grant, so it's emitted directly rather than
    // through the rule runner — the "never an empty clean result" invariant
    // (§8 rule 5) needs to hold even when there's nothing to build a Grant from.
    result.findings.push({
      ruleId: "PL-GEN-003",
      severity: "info",
      confidence: "certain",
      title: "Input not supported",
      detail: reason,
      evidence: {},
      grantId: "",
      docsUrl: "docs/rules/PL-GEN-003.md",
    });
  }

  return result;
}

/**
 * Resolves registry facts for a grant using whichever match §7.2's matching
 * order can reach given what's known so far: address (always available),
 * then codehash/normalizedCodehash (only meaningful once
 * `@permissionlens/onchain`'s `enrich()` has fetched code and set
 * `grant.facts.codehash`/`normalizedCodehash` — before that, those lookups
 * are skipped rather than attempted against `undefined`).
 *
 * Exported so `enrich()` can call it again after adding codehash facts, to
 * pick up a match `decode()` couldn't reach on address alone.
 */
export function applyRegistryFacts(grant: Grant, options: DecodeOptions): void {
  if (!options.registry || grant.grantee.type !== "code") return;
  if (grant.facts.registryStatus !== undefined) return;

  const registry = options.registry;
  let entry = registry.lookupAddress(grant.grantee.address, options.chainId);

  const codehash = grant.facts.codehash;
  if (!entry && typeof codehash === "string" && registry.lookupCodehash) {
    entry = registry.lookupCodehash(codehash as `0x${string}`);
  }

  const normalizedCodehash = grant.facts.normalizedCodehash;
  if (!entry && typeof normalizedCodehash === "string" && registry.lookupNormalizedCodehash) {
    entry = registry.lookupNormalizedCodehash(normalizedCodehash as `0x${string}`);
  }

  if (!entry) return;
  grant.facts.registryStatus = entry.status;
  grant.facts.registryName = entry.name;
  if (entry.vendor) grant.facts.registryVendor = entry.vendor;
  if (entry.properties?.initialization) grant.facts.registryInitialization = entry.properties.initialization;
  if (entry.properties?.storage) grant.facts.registryStorage = entry.properties.storage;
  if (entry.properties?.upgradeable !== undefined) grant.facts.registryUpgradeable = entry.properties.upgradeable;
}

/** PL-7710-008: is `grant.facts.delegationManager` a registry-known DelegationManager deployment? */
export function applyDelegationManagerFacts(grant: Grant, options: DecodeOptions): void {
  if (!options.registry) return;
  const delegationManager = grant.facts.delegationManager;
  if (typeof delegationManager !== "string") return;
  const entry = options.registry.lookupAddress(delegationManager as `0x${string}`, options.chainId);
  grant.facts.delegationManagerRecognized = entry?.kind === "delegation-manager";
}
