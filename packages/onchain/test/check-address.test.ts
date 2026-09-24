import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ChildProcess, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http } from "viem";
import type { PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkAddressDelegation } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(here, "..", "..", "..", "contracts");

function readArtifact(name: string): { abi: unknown[]; bytecode: `0x${string}` } {
  const json = JSON.parse(readFileSync(path.join(contractsDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
  return { abi: json.abi, bytecode: json.bytecode.object };
}

const DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil account #0
const PORT = 8945 + (process.pid % 1000);
const RPC_URL = `http://127.0.0.1:${PORT}`;

let anvil: ChildProcess;
let client: PublicClient;

beforeAll(async () => {
  anvil = spawn("anvil", ["--port", String(PORT), "--silent"], { stdio: "ignore" });
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
  const account = privateKeyToAccount(DEPLOYER_PK);
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const hash = await walletClient.deployContract({ abi, bytecode, args: [], chain: null });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${contractName} deployment produced no contractAddress`);
  return receipt.contractAddress;
}

/** anvil's `anvil_setCode` cheat lets a test set arbitrary code at an address — used here to place a real EIP-7702 delegation indicator (`0xef0100 || delegate`) without needing a live type-0x04 transaction, matching how enrich.test.ts avoids one for the same reason (see its top comment). */
async function setDelegationIndicator(address: `0x${string}`, delegate: `0x${string}`): Promise<void> {
  const code = `0xef0100${delegate.slice(2)}` as `0x${string}`;
  await client.request({ method: "anvil_setCode" as never, params: [address, code] as never });
}

describe("checkAddressDelegation() against a real anvil node", () => {
  it("reports unsupported for an address with no delegation indicator", async () => {
    const plainEoa = "0x00000000000000000000000000000000000000e0" as `0x${string}`;
    const result = await checkAddressDelegation(plainEoa, { client });
    expect(result.unsupported).toBeDefined();
    expect(result.grants).toHaveLength(0);
  });

  it("builds and enriches a grant for a currently-delegated address, firing PL-7702-011 for a sweeper delegate", async () => {
    const sweeperAddress = await deploy("SweeperDelegate");
    const authority = "0x00000000000000000000000000000000000000e1" as `0x${string}`;
    await setDelegationIndicator(authority, sweeperAddress);

    const result = await checkAddressDelegation(authority, { client });

    expect(result.unsupported).toBeUndefined();
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]!.grantor?.toLowerCase()).toBe(authority.toLowerCase());
    expect(result.grants[0]!.grantee.type).toBe("code");
    const grantee = result.grants[0]!.grantee as { type: "code"; address: `0x${string}` };
    expect(grantee.address.toLowerCase()).toBe(sweeperAddress.toLowerCase());
    expect(result.findings.find((f) => f.ruleId === "PL-7702-011")).toBeDefined();
  });

  it("does not fire PL-7702-011 for a currently-delegated benign delegate", async () => {
    const benignAddress = await deploy("BenignDelegate");
    const authority = "0x00000000000000000000000000000000000000e2" as `0x${string}`;
    await setDelegationIndicator(authority, benignAddress);

    const result = await checkAddressDelegation(authority, { client });

    expect(result.findings.find((f) => f.ruleId === "PL-7702-011")).toBeUndefined();
  });
});
