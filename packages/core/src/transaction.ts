import { parseTransaction, recoverTransactionAddress } from "viem";
import type { Address, Hex } from "viem";
import { normalizeAuthorization } from "./authorization.js";
import type { NormalizedAuthorization } from "./authorization.js";

export interface Parsed7702Transaction {
  sender: Address | null;
  authorizations: NormalizedAuthorization[];
}

/**
 * A type-0x04 ("set code") transaction carries a non-empty `authorizationList`.
 * The tx *sender* and each authorization's *signer* can differ — a relayer
 * can submit tuples signed by someone else (LEARNING.md §5.1). We surface the
 * sender only as context; each tuple is still evaluated as its own grant.
 */
export async function parse7702Transaction(serialized: Hex): Promise<Parsed7702Transaction> {
  const tx = parseTransaction(serialized);

  if (tx.type !== "eip7702" || !tx.authorizationList || tx.authorizationList.length === 0) {
    throw new Error("not a type-0x04 (EIP-7702) transaction with a non-empty authorizationList");
  }

  let sender: Address | null = null;
  try {
    sender = await recoverTransactionAddress({ serializedTransaction: serialized as `0x04${string}` });
  } catch {
    sender = null;
  }

  const authorizations: NormalizedAuthorization[] = tx.authorizationList.map((auth) => normalizeAuthorization(auth));

  return { sender, authorizations };
}
