import { normalizeAuthorization } from "@permissionlens/core";

/**
 * One EIP-7702 authorization tuple observed in a mined type-0x04
 * transaction, flattened out of `tx.authorizationList` (a single tx can
 * carry several).
 *
 * @typedef {object} CensusRecord
 * @property {number} blockNumber
 * @property {string} txHash
 * @property {string | null} sender - the tx sender, which can differ from the authority that signed the tuple (a relayer can submit someone else's authorization).
 * @property {number} chainId
 * @property {string} delegate - lowercased address
 */

/**
 * Scans `[fromBlock, toBlock]` (inclusive) for type-0x04 transactions and
 * flattens every authorization tuple in each one into a {@link CensusRecord}.
 * Per-block RPC failures are logged and skipped rather than aborting the
 * whole scan — a single bad block shouldn't lose the rest of a long range.
 *
 * @param {{
 *   client: import("viem").PublicClient,
 *   fromBlock: bigint,
 *   toBlock: bigint,
 *   concurrency?: number,
 *   onProgress?: (current: bigint, total: bigint) => void,
 * }} opts
 * @returns {Promise<CensusRecord[]>}
 */
export async function scanBlockRange({ client, fromBlock, toBlock, concurrency = 8, onProgress }) {
  if (toBlock < fromBlock) {
    throw new Error(`toBlock (${toBlock}) is before fromBlock (${fromBlock})`);
  }

  const blockNumbers = [];
  for (let n = fromBlock; n <= toBlock; n++) blockNumbers.push(n);

  const total = BigInt(blockNumbers.length);
  let done = 0n;
  const records = [];

  for (let i = 0; i < blockNumbers.length; i += concurrency) {
    const chunk = blockNumbers.slice(i, i + concurrency);
    const blocks = await Promise.all(
      chunk.map(async (blockNumber) => {
        try {
          return await client.getBlock({ blockNumber, includeTransactions: true });
        } catch (err) {
          console.error(`census: failed to fetch block ${blockNumber}: ${/** @type {Error} */ (err).message}`);
          return null;
        }
      }),
    );

    for (const block of blocks) {
      if (block) records.push(...recordsFromBlock(block));
      done += 1n;
      onProgress?.(done, total);
    }
  }

  return records;
}

/**
 * @param {import("viem").Block<bigint, true>} block
 * @returns {CensusRecord[]}
 */
function recordsFromBlock(block) {
  const records = [];
  for (const tx of block.transactions) {
    if (typeof tx === "string") continue; // includeTransactions: true always hydrates these; guards the type only.
    if (tx.type !== "eip7702" || !tx.authorizationList || tx.authorizationList.length === 0) continue;

    for (const raw of tx.authorizationList) {
      let normalized;
      try {
        normalized = normalizeAuthorization(raw);
      } catch (err) {
        console.error(`census: skipping malformed authorization in ${tx.hash}: ${/** @type {Error} */ (err).message}`);
        continue;
      }

      records.push({
        blockNumber: Number(block.number),
        txHash: tx.hash,
        sender: tx.from ?? null,
        chainId: Number(normalized.chainId),
        delegate: normalized.address.toLowerCase(),
      });
    }
  }
  return records;
}
