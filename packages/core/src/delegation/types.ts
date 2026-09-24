import type { Address, Hex } from "viem";

/** Wire shape of a `Delegation` message (LEARNING.md §7.1) — what shows up inside an `eth_signTypedData_v4` request or a decoded 7715 `context`. */
export interface DelegationLike {
  delegate: Address;
  delegator: Address;
  authority: Hex;
  caveats: CaveatLike[];
  salt: bigint | number | string;
  /** Never part of the signed hash — a redeemer could alter this without invalidating anything. Present only for a delegation that's already been signed. */
  signature?: Hex;
}

export interface CaveatLike {
  enforcer: Address;
  terms: Hex;
  /** Redeemer-supplied, NOT signed (LEARNING.md §7.1) — never treat this as something the delegator vouched for. */
  args?: Hex;
}
