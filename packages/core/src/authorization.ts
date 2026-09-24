import { concat, keccak256, numberToHex, recoverAddress, toRlp } from "viem";
import type { Address, Hex } from "viem";
import type { AuthorizationLike } from "./types.js";

/** EIP-7702 domain separator prefixing the RLP payload before hashing. */
const MAGIC = "0x05" as const;

/**
 * RLP encodes the integer 0 as the empty string, not as a 0x00 byte.
 * Encoding zero as 0x00 produces a different digest and "recovers" a random
 * address — see LEARNING.md §5.2 and Lab 6. This is the single most
 * important correctness detail in the whole parser.
 */
function rlpInt(n: bigint): Hex | "0x" {
  return n === 0n ? "0x" : numberToHex(n);
}

export interface NormalizedAuthorization {
  chainId: bigint;
  address: Address;
  nonce: bigint;
  signature?: { r: Hex; s: Hex; yParity: number };
}

export class AuthorizationParseError extends Error {}

/** Accepts either `address` or `contractAddress` — both spellings appear across viem versions and wallet tooling. */
export function normalizeAuthorization(auth: AuthorizationLike): NormalizedAuthorization {
  const address = auth.address ?? auth.contractAddress;
  if (!address) {
    throw new AuthorizationParseError("authorization has neither `address` nor `contractAddress`");
  }

  const chainId = BigInt(auth.chainId);
  const nonce = BigInt(auth.nonce);

  let signature: NormalizedAuthorization["signature"];
  if (auth.r !== undefined && auth.s !== undefined) {
    const yParity = auth.yParity ?? (auth.v !== undefined ? Number(auth.v) - 27 : undefined);
    if (yParity === undefined) {
      throw new AuthorizationParseError("signed authorization is missing yParity/v");
    }
    signature = { r: auth.r, s: auth.s, yParity };
  }

  return { chainId, address, nonce, signature };
}

/** `keccak256(0x05 || rlp([chainId, address, nonce]))` — see LEARNING.md §5.2. */
export function hashAuthorization(auth: Pick<NormalizedAuthorization, "chainId" | "address" | "nonce">): Hex {
  return keccak256(concat([MAGIC, toRlp([rlpInt(auth.chainId), auth.address, rlpInt(auth.nonce)])]));
}

/** `s` must be at most `n/2` (secp256k1 order / 2) — EIP-2 malleability guard, also required on-chain (LEARNING.md §5.3). */
const SECP256K1_N_OVER_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

export function isLowS(s: Hex): boolean {
  return BigInt(s) <= SECP256K1_N_OVER_2;
}

export interface RecoverResult {
  authority: Address;
  lowS: boolean;
}

/** Recovers the signing authority. Does not throw on high-s; check `lowS` and flag it (PL-7702-014) instead of rejecting outright, since a decoder's job is to report what a signature says, not to enforce consensus rules itself. */
export async function recoverAuthority(auth: NormalizedAuthorization): Promise<RecoverResult> {
  if (!auth.signature) {
    throw new AuthorizationParseError("cannot recover authority from an unsigned authorization");
  }
  const digest = hashAuthorization(auth);
  const authority = await recoverAddress({
    hash: digest,
    signature: {
      r: auth.signature.r,
      s: auth.signature.s,
      yParity: auth.signature.yParity as 0 | 1,
    },
  });
  return { authority, lowS: isLowS(auth.signature.s) };
}
