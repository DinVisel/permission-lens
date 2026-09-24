import type { Address, Hex } from "viem";

/**
 * Wire shape of one `wallet_requestExecutionPermissions` request/response
 * item. Verified against `@metamask/7715-permission-types` /
 * `smart-accounts-kit`'s `erc7715Types.ts` (fetched 2026-09-24) — see
 * `KNOWN_PERMISSION_TYPES` in `../rules/7715.ts` for the pinned revision
 * note (LEARNING.md §8.4: "the spec is still a draft ... parsers must be
 * versioned").
 */
export interface PermissionRequestLike {
  chainId: Hex | number;
  from?: Address;
  to: Address;
  permission: {
    type: string;
    isAdjustmentAllowed: boolean;
    data: Record<string, unknown>;
  };
  rules?: RuleLike[] | null;
}

export interface RuleLike {
  type: string;
  data: Record<string, unknown>;
}

export interface PermissionResponseLike extends PermissionRequestLike {
  context: Hex;
  dependencies?: { factory: Address; factoryData: Hex }[];
  delegationManager: Address;
}
