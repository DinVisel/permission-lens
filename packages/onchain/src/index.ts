import { allRules, runRules } from "@permissionlens/core";
import type { DecodeResult, RegistryLookup } from "@permissionlens/core";
import type { PublicClient } from "viem";
import { enrichGrant } from "./enrich-grant.js";

export { checkAddressDelegation } from "./check-address.js";
export type { CheckAddressOptions } from "./check-address.js";

export interface EnrichOptions {
  client: PublicClient;
  chainId?: number;
  registry?: RegistryLookup;
  registryVersion?: string;
}

/**
 * Fetches on-chain facts (delegate code, codehash, proxy detection, the
 * authority's current nonce) so the chain-dependent rules
 * (PL-7702-002 by codehash/006/007/009/010/011) can run, then re-runs the
 * full rule set with those facts added — findings/notChecked/checkedRuleIds
 * on the returned result reflect everything now knowable, not just what
 * `decode()` could tell offline (IMPLEMENTATION_PLAN.md §4.1's "re-run
 * rules" step in the data-flow diagram).
 *
 * Still open (Phase 2, IMPLEMENTATION_PLAN.md §9): Sourcify verification
 * (PL-7702-008) and cross-chain code comparison (PL-7702-012) — both need
 * a network call this function doesn't make yet.
 */
export async function enrich(result: DecodeResult, options: EnrichOptions): Promise<DecodeResult> {
  const grants = await Promise.all(result.grants.map((grant) => enrichGrant(grant, options)));

  const ctx = { chainId: options.chainId, registry: options.registry };
  const { findings, notChecked, checkedRuleIds } = runRules(grants, allRules, ctx);

  return {
    ...result,
    grants,
    findings,
    notChecked,
    checkedRuleIds,
    registryVersion: options.registry ? (options.registryVersion ?? result.registryVersion) : result.registryVersion,
  };
}
