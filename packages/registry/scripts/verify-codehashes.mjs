// Nightly, non-blocking CI check (IMPLEMENTATION_PLAN.md §9 Phase 2): fetches
// each `recognized`/`caution` entry's deployment code from a public RPC and
// confirms it still matches the entry's `codehash`. Never blocks the main
// CI pipeline — a registry entry going stale (redeployed, selfdestructed,
// RPC hiccup) shouldn't fail unrelated PRs; it should just get reported.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeCodehash } from "@permissionlens/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");

// Public RPC endpoints requiring no API key, one per chain we might see a
// deployment on (IMPLEMENTATION_PLAN.md §14: mainnet, Base, Optimism,
// Arbitrum, Sepolia are the recommended registry v1 chains). Extend as
// entries for other chains get added.
const PUBLIC_RPC_BY_CHAIN_ID = {
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  10: "https://mainnet.optimism.io",
  42161: "https://arb1.arbitrum.io/rpc",
  11155111: "https://rpc.sepolia.org",
};

async function getCode(chainId, address) {
  const rpcUrl = PUBLIC_RPC_BY_CHAIN_ID[chainId];
  if (!rpcUrl) return { skipped: `no known public RPC for chainId ${chainId}` };

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
  });
  const json = await response.json();
  if (json.error) return { error: json.error.message };
  return { code: json.result };
}

let mismatches = 0;
let skipped = 0;
let checked = 0;

for (const file of readdirSync(dataDir)) {
  if (!file.endsWith(".json")) continue;
  const entry = JSON.parse(readFileSync(path.join(dataDir, file), "utf8"));
  if (entry.status === "malicious" || !entry.match.codehash || !entry.match.deployments?.length) continue;

  for (const deployment of entry.match.deployments) {
    const result = await getCode(deployment.chainId, deployment.address);
    if (result.skipped) {
      console.log(`⚠ ${file} @ chain ${deployment.chainId}: ${result.skipped}`);
      skipped++;
      continue;
    }
    if (result.error) {
      console.log(`⚠ ${file} @ chain ${deployment.chainId}: RPC error — ${result.error}`);
      skipped++;
      continue;
    }

    checked++;
    const actualCodehash = computeCodehash(result.code);
    if (actualCodehash.toLowerCase() !== entry.match.codehash.toLowerCase()) {
      console.error(`✗ ${file} @ chain ${deployment.chainId}: codehash mismatch`);
      console.error(`    expected ${entry.match.codehash}`);
      console.error(`    actual   ${actualCodehash}`);
      mismatches++;
    } else {
      console.log(`✓ ${file} @ chain ${deployment.chainId}`);
    }
  }
}

console.log(`\n${checked} checked, ${mismatches} mismatched, ${skipped} skipped.`);

// Deliberately does NOT set a non-zero exit code — see the file header.
// A mismatch is worth a human looking at the entry, not a build failure.
if (mismatches > 0) {
  console.error("\nOne or more registry entries no longer match their deployed code — please review.");
}
