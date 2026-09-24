import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ChildProcess, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http } from "viem";
import type { PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scanBlockRange } from "../src/scan.mjs";
import { fetchBytecodeForAddresses } from "../src/fetch-bytecode.mjs";
import { buildClusters } from "../src/cluster.mjs";

// Real anvil integration test, `--hardfork prague` (IMPLEMENTATION_PLAN.md
// §7.4/§9 Phase 2). Unlike packages/onchain's tests — which only need to
// read a delegate's bytecode or an authority's nonce and deliberately avoid
// submitting a live type-0x04 transaction (see enrich.test.ts's top
// comment) — census exists specifically to scan mined type-0x04
// transactions, so this test has to submit real ones.

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(here, "..", "..", "..", "contracts");

function readArtifact(name: string): { abi: unknown[]; bytecode: `0x${string}` } {
  const json = JSON.parse(readFileSync(path.join(contractsDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
  return { abi: json.abi, bytecode: json.bytecode.object };
}

// Anvil's well-known default dev accounts (mnemonic "test test test ...
// junk") — public, local-only, never hold real funds. #0 is used elsewhere
// in this repo as the deployer/relayer; #1 and #2 are two more of the same
// default set, used here as two distinct authorities.
const RELAYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const AUTHORITY_A_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const AUTHORITY_B_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const PORT = 8945 + (process.pid % 1000);
const RPC_URL = `http://127.0.0.1:${PORT}`;

let anvil: ChildProcess;
let client: PublicClient;

beforeAll(async () => {
  anvil = spawn("anvil", ["--port", String(PORT), "--hardfork", "prague", "--silent"], { stdio: "ignore" });
  client = createPublicClient({ transport: http(RPC_URL) });
  await waitForAnvil();
}, 30_000);

afterAll(() => {
  anvil.kill();
});

async function waitForAnvil(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await client.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`anvil did not become ready on ${RPC_URL}`);
}

async function deploy(contractName: string): Promise<`0x${string}`> {
  const { abi, bytecode } = readArtifact(contractName);
  const account = privateKeyToAccount(RELAYER_PK);
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const hash = await walletClient.deployContract({ abi, bytecode, args: [], chain: null });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${contractName} deployment produced no contractAddress`);
  return receipt.contractAddress;
}

/** Authority signs an authorization for `delegate`; relayer submits the real type-0x04 transaction. */
async function submitAuthorization(authorityPk: `0x${string}`, delegate: `0x${string}`): Promise<{ blockNumber: bigint; txHash: `0x${string}` }> {
  const authority = privateKeyToAccount(authorityPk);
  const relayer = privateKeyToAccount(RELAYER_PK);
  const authorityClient = createWalletClient({ account: authority, transport: http(RPC_URL) });
  const relayerClient = createWalletClient({ account: relayer, transport: http(RPC_URL) });

  const authorization = await authorityClient.signAuthorization({ contractAddress: delegate });
  const txHash = await relayerClient.sendTransaction({
    to: authority.address,
    authorizationList: [authorization],
    chain: null,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { blockNumber: receipt.blockNumber, txHash };
}

describe("census scan + cluster against a real anvil node", () => {
  it("clusters two authorizations pointing at the same delegate together, and a third at a different one separately", async () => {
    const sweeper = await deploy("SweeperDelegate");
    const benign = await deploy("BenignDelegate");

    const first = await submitAuthorization(AUTHORITY_A_PK, sweeper);
    const second = await submitAuthorization(AUTHORITY_B_PK, sweeper);
    const third = await submitAuthorization(AUTHORITY_A_PK, benign);

    const fromBlock = [first, second, third].reduce((min, r) => (r.blockNumber < min ? r.blockNumber : min), first.blockNumber);
    const toBlock = await client.getBlockNumber();

    const records = await scanBlockRange({ client, fromBlock, toBlock });
    expect(records).toHaveLength(3);
    expect(new Set(records.map((r) => r.txHash))).toEqual(new Set([first.txHash, second.txHash, third.txHash]));

    const addresses = [...new Set(records.map((r) => r.delegate))];
    const bytecodeByAddress = await fetchBytecodeForAddresses({ client, addresses });
    expect(bytecodeByAddress.get(sweeper.toLowerCase())).not.toBe("0x");

    const clusters = buildClusters({ records, bytecodeByAddress });
    expect(clusters).toHaveLength(2);

    const sweeperCluster = clusters.find((c) => c.addresses.some((a) => a.address === sweeper.toLowerCase()));
    const benignCluster = clusters.find((c) => c.addresses.some((a) => a.address === benign.toLowerCase()));

    expect(sweeperCluster?.totalCount).toBe(2);
    expect(sweeperCluster?.addresses).toHaveLength(1); // same delegate address both times, not just same codehash.
    expect(benignCluster?.totalCount).toBe(1);
    expect(sweeperCluster?.normalizedCodehash).not.toBe(benignCluster?.normalizedCodehash);
  });
});
