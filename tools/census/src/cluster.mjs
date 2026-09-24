import { computeCodehash, computeNormalizedCodehash } from "@permissionlens/core";

/**
 * @typedef {object} Cluster
 * @property {string} key - `normalizedCodehash` when bytecode was available, else `address:<addr>` for a singleton.
 * @property {string | null} normalizedCodehash
 * @property {number} totalCount
 * @property {{ address: string, count: number, chainIds: number[] }[]} addresses
 * @property {string[]} sampleTxHashes
 * @property {"recognized" | "caution" | "malicious" | "unknown"} registryStatus
 * @property {string | null} registryName
 */

const MAX_SAMPLE_TX_HASHES = 5;

/**
 * Groups {@link CensusRecord}s by delegate address, then groups addresses
 * into clusters by `normalizedCodehash` (two delegates that differ only in
 * an embedded constant — e.g. a sweeper cloned with a different collector
 * address — cluster together). An address whose bytecode wasn't fetched
 * (no `bytecodeByAddress` entry, or it has no code at all) becomes its own
 * singleton cluster rather than being dropped, so it still shows up in the
 * ranking for manual review.
 *
 * @param {{
 *   records: import("./scan.mjs").CensusRecord[],
 *   bytecodeByAddress?: Map<string, `0x${string}`>,
 *   registry?: import("@permissionlens/registry").Registry,
 * }} opts
 * @returns {Cluster[]}
 */
export function buildClusters({ records, bytecodeByAddress = new Map(), registry }) {
  /** @type {Map<string, { count: number, chainIds: Set<number>, txHashes: string[] }>} */
  const byAddress = new Map();

  for (const record of records) {
    let entry = byAddress.get(record.delegate);
    if (!entry) {
      entry = { count: 0, chainIds: new Set(), txHashes: [] };
      byAddress.set(record.delegate, entry);
    }
    entry.count += 1;
    entry.chainIds.add(record.chainId);
    if (entry.txHashes.length < MAX_SAMPLE_TX_HASHES) entry.txHashes.push(record.txHash);
  }

  /** @type {Map<string, Cluster>} */
  const clusters = new Map();

  for (const [address, entry] of byAddress) {
    const bytecode = bytecodeByAddress.get(address);
    const normalizedCodehash = bytecode && bytecode !== "0x" ? computeNormalizedCodehash(bytecode) : null;
    const key = normalizedCodehash ?? `address:${address}`;

    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        key,
        normalizedCodehash,
        totalCount: 0,
        addresses: [],
        sampleTxHashes: [],
        registryStatus: "unknown",
        registryName: null,
      };
      clusters.set(key, cluster);
    }

    cluster.totalCount += entry.count;
    cluster.addresses.push({ address, count: entry.count, chainIds: [...entry.chainIds].sort((a, b) => a - b) });
    for (const hash of entry.txHashes) {
      if (cluster.sampleTxHashes.length < MAX_SAMPLE_TX_HASHES && !cluster.sampleTxHashes.includes(hash)) {
        cluster.sampleTxHashes.push(hash);
      }
    }

    if (registry) {
      annotateRegistryStatus(cluster, address, bytecode, registry);
    }
  }

  return [...clusters.values()].sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * @param {Cluster} cluster
 * @param {string} address
 * @param {`0x${string}` | undefined} bytecode
 * @param {import("@permissionlens/registry").Registry} registry
 */
function annotateRegistryStatus(cluster, address, bytecode, registry) {
  if (cluster.registryStatus === "recognized") return; // deployment matches take priority and never lose to a codehash match.

  const addressMatch = cluster.addresses
    .find((a) => a.address === address)
    ?.chainIds.map((chainId) => registry.lookupAddress(address, chainId))
    .find(Boolean);
  if (addressMatch) {
    setRegistryMatch(cluster, addressMatch);
    return;
  }

  if (cluster.registryStatus !== "unknown") return;

  if (bytecode && bytecode !== "0x") {
    const codehashMatch = registry.lookupCodehash(computeCodehash(bytecode));
    if (codehashMatch) {
      setRegistryMatch(cluster, codehashMatch);
      return;
    }
    if (cluster.normalizedCodehash) {
      const normalizedMatch = registry.lookupNormalizedCodehash(cluster.normalizedCodehash);
      if (normalizedMatch) setRegistryMatch(cluster, normalizedMatch);
    }
  }
}

/**
 * @param {Cluster} cluster
 * @param {import("@permissionlens/core").RegistryEntry} entry
 */
function setRegistryMatch(cluster, entry) {
  cluster.registryStatus = entry.status;
  cluster.registryName = entry.vendor ? `${entry.vendor} ${entry.name}` : entry.name;
}
