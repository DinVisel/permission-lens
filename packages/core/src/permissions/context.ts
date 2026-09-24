import { decodeAbiParameters } from "viem";
import type { Hex } from "viem";
import type { DelegationLike } from "../delegation/types.js";

/**
 * `context`'s ABI type, verified directly against MetaMask's
 * `@metamask/delegation-core` source (`encodeDelegations`/`decodeDelegations`
 * in `delegation-core/src/delegation.ts`, fetched 2026-09-24) — LEARNING.md
 * §8.2 only says "opaque blob ... in MetaMask's implementation, encoded 7710
 * delegations" without the exact layout, so this was confirmed against the
 * vendor's own code rather than guessed: `(address,address,bytes32,
 * (address,bytes,bytes)[],uint256,bytes)[]`, i.e. an array of
 * `[delegate, delegator, authority, caveats[[enforcer, terms, args]], salt, signature]`.
 */
const DELEGATION_ARRAY_ABI_PARAMETER = {
  type: "tuple[]",
  components: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    {
      name: "caveats",
      type: "tuple[]",
      components: [
        { name: "enforcer", type: "address" },
        { name: "terms", type: "bytes" },
        { name: "args", type: "bytes" },
      ],
    },
    { name: "salt", type: "uint256" },
    { name: "signature", type: "bytes" },
  ],
} as const;

export class InvalidPermissionContextError extends Error {}

/**
 * Decodes a 7715 response's `context` into the delegation chain it actually
 * encodes. This is the "decode `context` into 7710 delegations" step
 * LEARNING.md §8.4 says is essential — the request only states what a dapp
 * *asked for*; `context` is what will actually be enforced on redemption.
 *
 * Per `decodeDelegations`' own doc comment in the vendor source, the chain
 * is ordered **leaf first**: index 0 is the delegation actually used for
 * this grant, with any parents following.
 */
export function decodeDelegationContext(context: Hex): DelegationLike[] {
  let decoded: readonly unknown[];
  try {
    [decoded] = decodeAbiParameters([DELEGATION_ARRAY_ABI_PARAMETER], context);
  } catch (err) {
    throw new InvalidPermissionContextError(`context is not a valid encoded delegation array: ${(err as Error).message}`);
  }

  return (decoded as readonly DecodedDelegation[]).map(
    ({ delegate, delegator, authority, caveats, salt, signature }): DelegationLike => ({
      delegate,
      delegator,
      authority,
      caveats: caveats.map(({ enforcer, terms, args }) => ({ enforcer, terms, args })),
      salt,
      signature,
    }),
  );
}

/** viem returns named-component ABI tuples as objects (not positional arrays) since `DELEGATION_ARRAY_ABI_PARAMETER`'s components carry `name`. */
interface DecodedDelegation {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: Hex;
  caveats: readonly { enforcer: `0x${string}`; terms: Hex; args: Hex }[];
  salt: bigint;
  signature: Hex;
}
