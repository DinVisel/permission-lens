import type { DecodeResult, Grant } from "@permissionlens/core";
import type { PublicClient } from "viem";

export interface EnrichOptions {
  client: PublicClient;
}

/**
 * Phase 2 scope (IMPLEMENTATION_PLAN.md §9, Phase 2): fetch on-chain facts
 * (delegate code, proxy detection, nonce, verification) so chain-dependent
 * rules (PL-7702-006/007/008/009/010/011/012) can run. Stubbed for Phase 1:
 * fills `facts.codeAt` for `code` grantees so a caller wiring this in early
 * doesn't get silent no-ops, and leaves the rest as a documented gap.
 */
export async function enrich(result: DecodeResult, options: EnrichOptions): Promise<DecodeResult> {
  const grants: Grant[] = await Promise.all(
    result.grants.map(async (grant) => {
      if (grant.grantee.type !== "code") return grant;
      const code = await options.client.getCode({ address: grant.grantee.address });
      return {
        ...grant,
        facts: { ...grant.facts, codeAt: code ?? "0x" },
      };
    }),
  );

  return { ...result, grants };
}
