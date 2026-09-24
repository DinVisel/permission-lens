import type { Address, Hex, TypedDataDomain } from "viem";

/** This delegation comes directly from the delegator — not a re-delegation (LEARNING.md §7.2). */
export const ROOT_AUTHORITY: Hex = `0x${"ff".repeat(32)}`;

/** A bearer delegation: anyone holding the signature can redeem it (LEARNING.md §7.2). */
export const ANY_DELEGATE: Address = "0x0000000000000000000000000000000000000a11";

/**
 * EIP-712 domain a delegation must be signed under (LEARNING.md §7.1). The
 * chain is carried in the domain's `chainId`, not in the `Delegation` struct
 * itself — the struct has no chain field.
 */
export function isDelegationManagerDomain(domain: TypedDataDomain | undefined): boolean {
  return domain?.name === "DelegationManager" && domain?.version === "1";
}

/**
 * The exact EIP-712 type set a `Delegation` is signed under. Notably
 * excludes `Caveat.args` and `Delegation.signature` — neither is part of
 * the signed hash (LEARNING.md §7.1), so a redeemer can supply/alter `args`
 * without invalidating the signature. A decoder must never present `args`
 * as something the delegator vouched for.
 */
export const DELEGATION_TYPES = {
  Delegation: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    { name: "caveats", type: "Caveat[]" },
    { name: "salt", type: "uint256" },
  ],
  Caveat: [
    { name: "enforcer", type: "address" },
    { name: "terms", type: "bytes" },
  ],
} as const;
