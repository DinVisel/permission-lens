import { describe, expect, it } from "vitest";
import { privateKeyToAccount, sign } from "viem/accounts";
import { zeroAddress } from "viem";
import type { Address, Hex } from "viem";
import { decode } from "./decode.js";
import { hashAuthorization } from "./authorization.js";
import { render } from "./render.js";
import type { RegistryEntry, RegistryLookup } from "./registry-types.js";

// Anvil's well-known default account #0 — safe to hardcode, it's a public test key.
const TEST_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY);
const DELEGATE: Address = "0x0000000000000000000000000000000000d31347";

async function signedAuthorization(overrides: { chainId?: bigint; address?: Address; nonce?: bigint } = {}) {
  const chainId = overrides.chainId ?? 1n;
  const address = overrides.address ?? DELEGATE;
  const nonce = overrides.nonce ?? 0n;
  const digest = hashAuthorization({ chainId, address, nonce });
  const signature = await sign({ hash: digest, privateKey: TEST_PRIVATE_KEY });
  return {
    chainId,
    address,
    nonce,
    r: signature.r,
    s: signature.s,
    v: signature.v,
  };
}

class StubRegistry implements RegistryLookup {
  constructor(private entries: Map<string, RegistryEntry>) {}
  lookupAddress(address: Address): RegistryEntry | null {
    return this.entries.get(address.toLowerCase()) ?? null;
  }
}

describe("decode() — EIP-7702 authorization", () => {
  it("recovers the authority and flags chain_id = 0 as critical when the delegate is unrecognized", async () => {
    const authorization = await signedAuthorization({ chainId: 0n });
    const result = await decode({ kind: "7702-authorization", authorization });

    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]!.grantor?.toLowerCase()).toBe(TEST_ACCOUNT.address.toLowerCase());

    const chainFinding = result.findings.find((f) => f.ruleId === "PL-7702-001");
    expect(chainFinding?.severity).toBe("critical");

    const unrecognized = result.findings.find((f) => f.ruleId === "PL-7702-003");
    expect(unrecognized).toBeDefined();
  });

  it("downgrades PL-7702-001 to high and fires PL-7702-004 when the delegate is recognized", async () => {
    const registry = new StubRegistry(
      new Map([[DELEGATE.toLowerCase(), { name: "Example Delegator", vendor: "Example Wallet", status: "recognized" }]]),
    );
    const authorization = await signedAuthorization({ chainId: 0n });
    const result = await decode({ kind: "7702-authorization", authorization }, { registry });

    const chainFinding = result.findings.find((f) => f.ruleId === "PL-7702-001");
    expect(chainFinding?.severity).toBe("high");
    expect(result.findings.find((f) => f.ruleId === "PL-7702-004")).toBeDefined();
    expect(result.findings.find((f) => f.ruleId === "PL-7702-003")).toBeUndefined();
  });

  it("flags a revoke (delegate = 0x0) with PL-7702-005 and no chain/registry findings", async () => {
    const authorization = await signedAuthorization({ address: zeroAddress, chainId: 1n });
    const result = await decode({ kind: "7702-authorization", authorization });

    expect(result.grants[0]!.scope.type).toBe("revoke");
    expect(result.findings.map((f) => f.ruleId)).toEqual(["PL-7702-005"]);
  });

  it("flags a high-s signature with PL-7702-014", async () => {
    const authorization = await signedAuthorization();
    // secp256k1 order n minus 1 — always in the upper half, so always high-s regardless of the original signature.
    const SECP256K1_N_MINUS_1 = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140n;
    const highS = `0x${SECP256K1_N_MINUS_1.toString(16)}` as Hex;

    const result = await decode({
      kind: "7702-authorization",
      authorization: { ...authorization, s: highS },
    });

    expect(result.findings.find((f) => f.ruleId === "PL-7702-014")).toBeDefined();
  });
});

describe("decode() — raw hash", () => {
  it("flags PL-GEN-001 as critical", async () => {
    const result = await decode({ kind: "raw-hash", hash: "0xdeadbeef00000000000000000000000000000000000000000000000000000000" as Hex });
    const finding = result.findings.find((f) => f.ruleId === "PL-GEN-001");
    expect(finding?.severity).toBe("critical");
  });
});

describe("decode() — unsupported input", () => {
  it("returns an explicit unsupported result instead of an empty clean one", async () => {
    const result = await decode({ kind: "rpc", method: "eth_getBalance", params: [] });
    expect(result.unsupported).toBeDefined();
    expect(result.grants).toHaveLength(0);
  });

  it("emits a PL-GEN-003 finding so a clean-looking empty result never happens silently", async () => {
    const result = await decode({ kind: "rpc", method: "eth_getBalance", params: [] });
    expect(result.findings).toEqual([
      expect.objectContaining({ ruleId: "PL-GEN-003", severity: "info" }),
    ]);
  });
});

describe("render() — never says safe (§8 rule 1)", () => {
  it("a clean result never contains the words 'safe' or 'secure'", async () => {
    const registry = new StubRegistry(
      new Map([[DELEGATE.toLowerCase(), { name: "Example Delegator", status: "recognized" }]]),
    );
    const authorization = await signedAuthorization({ chainId: 1n });
    const result = await decode({ kind: "7702-authorization", authorization }, { registry });

    for (const format of ["text", "json"] as const) {
      const output = render(result, { format }).toLowerCase();
      expect(output).not.toMatch(/\bsafe\b/);
      expect(output).not.toMatch(/\bsecure\b/);
    }
  });

  it("an unsupported result never contains the words 'safe' or 'secure'", async () => {
    const result = await decode({ kind: "rpc", method: "personal_ecRecover", params: [] });
    const output = render(result, { format: "text" }).toLowerCase();
    expect(output).not.toMatch(/\bsafe\b/);
    expect(output).not.toMatch(/\bsecure\b/);
  });
});
