#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { createPublicClient, http } from "viem";
import { loadDefaultRegistry } from "@permissionlens/registry";
import { scanBlockRange } from "./scan.mjs";
import { fetchBytecodeForAddresses } from "./fetch-bytecode.mjs";
import { buildClusters } from "./cluster.mjs";
import { toCsv, parseCsv } from "./csv.mjs";

const program = new Command();

program
  .name("permissionlens-census")
  .description(
    "Enumerate EIP-7702 type-0x04 authorizations, cluster delegates by normalizedCodehash, " +
      "and rank clusters against the registry (IMPLEMENTATION_PLAN.md §7.4).",
  )
  .option("--rpc <url>", "RPC URL to scan a live block range")
  .option("--from-block <n>", "first block to scan (required with --rpc)", parseBigInt)
  .option("--to-block <n>", "last block to scan (default: latest, with --rpc)", parseBigInt)
  .option("--input <path>", "a CSV of pre-collected records (e.g. a Dune export) with columns: blockNumber,txHash,chainId,delegate[,sender]")
  .requiredOption("--out <path>", "where to write the cluster ranking CSV")
  .option("--min-count <n>", "drop clusters seen fewer than this many times", (v) => Number.parseInt(v, 10), 1)
  .action(main);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function main(opts) {
  if (!opts.rpc && !opts.input) {
    console.error("Provide --rpc, --input, or both — nothing to scan otherwise.");
    process.exitCode = 1;
    return;
  }

  /** @type {import("./scan.mjs").CensusRecord[]} */
  const records = [];
  /** @type {import("viem").PublicClient | undefined} */
  let client;

  if (opts.rpc) {
    client = createPublicClient({ transport: http(opts.rpc) });

    if (opts.fromBlock === undefined) {
      console.error("--from-block is required with --rpc.");
      process.exitCode = 1;
      return;
    }
    const toBlock = opts.toBlock ?? (await client.getBlockNumber());

    console.error(`census: scanning blocks ${opts.fromBlock}..${toBlock} on ${opts.rpc}`);
    const rpcRecords = await scanBlockRange({
      client,
      fromBlock: opts.fromBlock,
      toBlock,
      onProgress: throttledProgress(),
    });
    console.error(`census: found ${rpcRecords.length} authorization(s) across the range`);
    records.push(...rpcRecords);
  }

  if (opts.input) {
    records.push(...recordsFromCsv(opts.input));
  }

  if (records.length === 0) {
    console.error("census: no authorizations found — nothing to write.");
    return;
  }

  /** @type {Map<string, `0x${string}`>} */
  let bytecodeByAddress = new Map();
  if (client) {
    const addresses = [...new Set(records.map((r) => r.delegate))];
    console.error(`census: fetching bytecode for ${addresses.length} unique delegate(s)`);
    bytecodeByAddress = await fetchBytecodeForAddresses({ client, addresses });
  } else {
    console.error("census: no --rpc given, so codehash clustering is skipped — clusters fall back to one per address. Pass --rpc (it can point at the same chain the --input data came from) to enable it.");
  }

  const registry = loadDefaultRegistry();
  const clusters = buildClusters({ records, bytecodeByAddress, registry }).filter((c) => c.totalCount >= opts.minCount);

  writeClustersCsv(opts.out, clusters);
  printSummary(clusters);
}

/** @param {string} path */
function recordsFromCsv(path) {
  const text = readFileSync(path, "utf8");
  const rows = parseCsv(text);
  return rows.map((row) => ({
    blockNumber: Number(row.blockNumber),
    txHash: row.txHash,
    sender: row.sender || null,
    chainId: Number(row.chainId),
    delegate: row.delegate.toLowerCase(),
  }));
}

/** @param {string} path @param {import("./cluster.mjs").Cluster[]} clusters */
function writeClustersCsv(path, clusters) {
  const headers = ["rank", "normalizedCodehash", "totalCount", "addressCount", "addresses", "chainIds", "registryStatus", "registryName", "sampleTxHashes"];
  const rows = clusters.map((cluster, i) => [
    i + 1,
    cluster.normalizedCodehash ?? "n/a",
    cluster.totalCount,
    cluster.addresses.length,
    cluster.addresses.map((a) => a.address).join(";"),
    [...new Set(cluster.addresses.flatMap((a) => a.chainIds))].sort((a, b) => a - b).join(";"),
    cluster.registryStatus,
    cluster.registryName ?? "",
    cluster.sampleTxHashes.join(";"),
  ]);
  writeFileSync(path, toCsv(headers, rows));
  console.error(`census: wrote ${clusters.length} cluster(s) to ${path}`);
}

/** @param {import("./cluster.mjs").Cluster[]} clusters */
function printSummary(clusters) {
  const top = clusters.slice(0, 20);
  console.log(`\nTop ${top.length} of ${clusters.length} cluster(s), by authorization count:\n`);
  for (const [i, cluster] of top.entries()) {
    const label = cluster.registryStatus === "unknown" ? "unrecognized — review candidate" : `${cluster.registryStatus}${cluster.registryName ? ` (${cluster.registryName})` : ""}`;
    console.log(`${i + 1}. ${cluster.totalCount}x — ${cluster.addresses.length} address(es) — ${label}`);
  }
}

/** @param {string} value */
function parseBigInt(value) {
  return BigInt(value);
}

function throttledProgress() {
  let last = 0;
  return (current, total) => {
    const now = Date.now();
    if (now - last < 2000 && current !== total) return;
    last = now;
    console.error(`census: scanned ${current}/${total} blocks`);
  };
}
