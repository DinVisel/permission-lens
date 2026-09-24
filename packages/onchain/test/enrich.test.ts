import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ChildProcess, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http, zeroAddress } from "viem";
import { hashAuthorization } from "@permissionlens/core";
import { decode } from "@permissionlens/core";
import type { PublicClient } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { enrich } from "../src/index.js";

// Real anvil integration test — IMPLEMENTATION_PLAN.md §9 Phase 2 acceptance
// criterion: "delegate an EOA to the sweeper fixture and PL-7702-011 fires;
// to the benign fixture and it doesn't." We deploy the real compiled fixture
// contracts and point a 7702 authorization at them; that's enough to
// exercise enrich()'s getCode + rule re-run path faithfully without also
// needing to submit a live type-0x04 transaction (enrich() only reads the
// delegate's own bytecode and the authority's nonce — whether the EOA is
// *currently* delegated on-chain doesn't change either of those).

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(here, "..", "..", "..", "contracts");

function readArtifact(name: string): { abi: unknown[]; bytecode: `0x${string}` } {
  const json = JSON.parse(readFileSync(path.join(contractsDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
  return { abi: json.abi, bytecode: json.bytecode.object };
}

const DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil account #0, funds contract deployments
// An arbitrary (unfunded) test key: the authority never needs funds here — it only signs
// off-chain and we read its nonce, we never submit a transaction from it.
const AUTHORITY_PK = "0x0e974cab901e20954b911af67c139cc89ebdede6bf8f9a07c3da11f64302faca";
const PORT = 8645 + (process.pid % 1000);
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
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: contractName === "ProxyDelegate" ? [zeroAddress] : [],
    chain: null,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${contractName} deployment produced no contractAddress`);
  return receipt.contractAddress;
}

async function grantFor(delegate: `0x${string}`) {
  const authority = privateKeyToAccount(AUTHORITY_PK);
  const digest = hashAuthorization({ chainId: 1n, address: delegate, nonce: 0n });
  const signature = await sign({ hash: digest, privateKey: AUTHORITY_PK });
  const result = await decode({
    kind: "7702-authorization",
    authorization: { chainId: 1, address: delegate, nonce: 0, r: signature.r, s: signature.s, v: signature.v },
  });
  expect(result.grants[0]!.grantor?.toLowerCase()).toBe(authority.address.toLowerCase());
  return result;
}

describe("enrich() against a real anvil node", () => {
  it("fires PL-7702-011 for a deployed SweeperDelegate", async () => {
    const address = await deploy("SweeperDelegate");
    const decoded = await grantFor(address);

    const enriched = await enrich(decoded, { client });

    expect(enriched.grants[0]!.facts.codeAt).not.toBe("0x");
    const finding = enriched.findings.find((f) => f.ruleId === "PL-7702-011");
    expect(finding).toBeDefined();
    expect(finding?.confidence).toBe("heuristic");
  });

  it("does not fire PL-7702-011 for a deployed BenignDelegate, and PL-7702-006 does not fire either", async () => {
    const address = await deploy("BenignDelegate");
    const decoded = await grantFor(address);

    const enriched = await enrich(decoded, { client });

    expect(enriched.grants[0]!.facts.codeAt).not.toBe("0x");
    expect(enriched.findings.find((f) => f.ruleId === "PL-7702-011")).toBeUndefined();
    expect(enriched.findings.find((f) => f.ruleId === "PL-7702-006")).toBeUndefined();
  });

  it("fires PL-7702-006 for a delegate with no code deployed", async () => {
    const noCodeAddress = "0x00000000000000000000000000000000000badc0" as `0x${string}`;
    const decoded = await grantFor(noCodeAddress);

    const enriched = await enrich(decoded, { client });

    expect(enriched.grants[0]!.facts.codeAt).toBe("0x");
    expect(enriched.findings.find((f) => f.ruleId === "PL-7702-006")).toBeDefined();
  });

  it("fires PL-7702-007 for a deployed ProxyDelegate and records its implementation", async () => {
    const implementation = await deploy("FixtureImplementation");
    const { abi, bytecode } = readArtifact("ProxyDelegate");
    const account = privateKeyToAccount(DEPLOYER_PK);
    const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
    const hash = await walletClient.deployContract({ abi, bytecode, args: [implementation], chain: null });
    const receipt = await client.waitForTransactionReceipt({ hash });
    const proxyAddress = receipt.contractAddress!;

    const decoded = await grantFor(proxyAddress);
    const enriched = await enrich(decoded, { client });

    const finding = enriched.findings.find((f) => f.ruleId === "PL-7702-007");
    expect(finding).toBeDefined();
    expect(enriched.grants[0]!.facts.proxyImplementation).toEqual(implementation);
  });

  it("sets currentNonce from the authority's real on-chain nonce", async () => {
    const address = await deploy("BenignDelegate");
    const decoded = await grantFor(address);
    const enriched = await enrich(decoded, { client });
    expect(enriched.grants[0]!.facts.currentNonce).toBe(0n);
  });
});
