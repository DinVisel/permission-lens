import { allRules, runRules } from "@permissionlens/core";
import type { DecodeResult, Grant, RegistryLookup } from "@permissionlens/core";
import type { Address, PublicClient } from "viem";
import { enrichGrant } from "./enrich-grant.js";

export interface CheckAddressOptions {
  client: PublicClient;
  chainId?: number;
  registry?: RegistryLookup;
  registryVersion?: string;
}

/** `0xef0100` — the EIP-7702 delegation indicator prefix a delegated EOA's code starts with (LEARNING.md §5.3). */
const DELEGATION_INDICATOR_PREFIX = "0xef0100";

/**
 * `permissionlens address <addr>`'s core: reads whether `address` is
 * *currently* delegated (its code is the `0xef0100 ‖ delegate` indicator,
 * not a signature we're deciding whether to sign) and, if so, builds and
 * enriches a Grant for it the same way `decode()` + `enrich()` would for a
 * fresh authorization — same rules, same registry lookup, same facts.
 *
 * This is a live on-chain *observation*, not a decode of something
 * presented for signing, so it lives in `@permissionlens/onchain` rather
 * than `@permissionlens/core`: it always needs a client, there's no
 * offline form of "what is this address delegated to right now."
 */
export async function checkAddressDelegation(address: Address, options: CheckAddressOptions): Promise<DecodeResult> {
  const code = (await options.client.getCode({ address })) ?? "0x";

  if (!code.toLowerCase().startsWith(DELEGATION_INDICATOR_PREFIX)) {
    return {
      specVersion: "1",
      grants: [],
      findings: [],
      notChecked: [],
      checkedRuleIds: [],
      unsupported: { reason: `${address} is not currently delegated (no EIP-7702 delegation indicator in its code).` },
      registryVersion: options.registryVersion ?? "unset",
    };
  }

  const delegate = `0x${code.slice(DELEGATION_INDICATOR_PREFIX.length)}` as Address;

  const grant: Grant = {
    id: `onchain:${options.chainId ?? "unknown"}:${address.toLowerCase()}`,
    standard: "7702",
    grantor: address,
    grantee: { type: "code", address: delegate },
    chains: options.chainId ? { type: "list", chainIds: [options.chainId] } : { type: "all" },
    scope: { type: "full-account" },
    validity: {},
    replay: {},
    revocation: {
      method: "Sign a new authorization to 0x0000000000000000000000000000000000000000",
      onchain: true,
      notes: "Observed on-chain — the original authorization's chain scope and nonce aren't recoverable from current state alone.",
    },
    facts: {},
    source: { input: { kind: "onchain-observation", address, chainId: options.chainId }, path: `onchain:${address}` },
  };

  const enriched = await enrichGrant(grant, options);
  const ctx = { chainId: options.chainId, registry: options.registry };
  const { findings, notChecked, checkedRuleIds } = runRules([enriched], allRules, ctx);

  return {
    specVersion: "1",
    grants: [enriched],
    findings,
    notChecked,
    checkedRuleIds,
    registryVersion: options.registry ? (options.registryVersion ?? "unset") : "unset",
  };
}
