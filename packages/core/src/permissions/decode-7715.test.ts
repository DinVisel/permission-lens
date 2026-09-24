import { describe, expect, it } from "vitest";
import { privateKeyToAccount, signTypedData } from "viem/accounts";
import { concat, encodeAbiParameters, numberToHex, pad, toHex } from "viem";
import type { Address, Hex } from "viem";
import { decode } from "../decode.js";
import { DELEGATION_TYPES, ROOT_AUTHORITY } from "../delegation/constants.js";
import { decodeDelegationContext } from "./context.js";
import type { RegistryEntry, RegistryLookup } from "../registry-types.js";

const TEST_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DELEGATOR = privateKeyToAccount(TEST_PRIVATE_KEY);
const SESSION_KEY: Address = "0x0000000000000000000000000000000000005e55";
const DELEGATION_MANAGER: Address = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";
const ERC20_TRANSFER_AMOUNT_ENFORCER: Address = "0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc";
const TIMESTAMP_ENFORCER: Address = "0x1046bb45C8d673d4ea75321280DB34899413c069";
const USDC: Address = "0x00000000000000000000000000000000000000C2";

class StubRegistry implements RegistryLookup {
  constructor(private entries: Map<string, RegistryEntry>) {}
  lookupAddress(address: Address): RegistryEntry | null {
    return this.entries.get(address.toLowerCase()) ?? null;
  }
}

function registry(entries: [Address, RegistryEntry][]): StubRegistry {
  return new StubRegistry(new Map(entries.map(([a, e]) => [a.toLowerCase(), e])));
}

const delegationManagerEntry: RegistryEntry = { name: "DelegationManager", status: "recognized", kind: "delegation-manager" };
const erc20EnforcerEntry: RegistryEntry = { name: "ERC20TransferAmountEnforcer", status: "recognized", kind: "caveat-enforcer", decoder: "metamask/erc20-transfer-amount@1" };
const timestampEnforcerEntry: RegistryEntry = { name: "TimestampEnforcer", status: "recognized", kind: "caveat-enforcer", decoder: "metamask/timestamp@1" };

const FULL_REGISTRY = registry([
  [DELEGATION_MANAGER, delegationManagerEntry],
  [ERC20_TRANSFER_AMOUNT_ENFORCER, erc20EnforcerEntry],
  [TIMESTAMP_ENFORCER, timestampEnforcerEntry],
]);

const DELEGATION_ARRAY_ABI_PARAMETER = {
  type: "tuple[]",
  components: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    {
      name: "caveats",
      type: "tuple[]",
      components: [
        { name: "enforcer", type: "address" },
        { name: "terms", type: "bytes" },
        { name: "args", type: "bytes" },
      ],
    },
    { name: "salt", type: "uint256" },
    { name: "signature", type: "bytes" },
  ],
} as const;

function timestampTerms(after: bigint, before: bigint): Hex {
  return concat([pad(numberToHex(after), { size: 16 }), pad(numberToHex(before), { size: 16 })]);
}

async function buildEncodedContext(caveats: { enforcer: Address; terms: Hex }[]): Promise<Hex> {
  const message = {
    delegate: SESSION_KEY,
    delegator: DELEGATOR.address,
    authority: ROOT_AUTHORITY,
    caveats: caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
    salt: 0n,
  };

  const signature = await signTypedData({
    privateKey: TEST_PRIVATE_KEY,
    domain: { name: "DelegationManager", version: "1", chainId: 1, verifyingContract: DELEGATION_MANAGER },
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message,
  });

  return encodeAbiParameters(
    [DELEGATION_ARRAY_ABI_PARAMETER],
    [
      [
        {
          delegate: message.delegate,
          delegator: message.delegator,
          authority: message.authority,
          caveats: caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms, args: "0x" as Hex })),
          salt: 0n,
          signature,
        },
      ],
    ],
  );
}

describe("decodeDelegationContext", () => {
  it("round-trips a real ABI-encoded delegation array", async () => {
    const context = await buildEncodedContext([{ enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) }]);
    const delegations = decodeDelegationContext(context);
    expect(delegations).toHaveLength(1);
    expect(delegations[0]!.delegate.toLowerCase()).toBe(SESSION_KEY.toLowerCase());
    expect(delegations[0]!.delegator.toLowerCase()).toBe(DELEGATOR.address.toLowerCase());
    expect(delegations[0]!.caveats).toHaveLength(1);
  });
});

describe("decode() — ERC-7715 request", () => {
  const baseRequest = {
    chainId: toHex(1),
    from: DELEGATOR.address,
    to: SESSION_KEY,
    permission: { type: "erc20-token-allowance", isAdjustmentAllowed: true, data: { tokenAddress: USDC, allowanceAmount: toHex(1000n) } },
    rules: [{ type: "expiry", data: { timestamp: 9_999_999_999 } }],
  };

  it("decodes a request with an expiry rule and doesn't fire PL-7715-002", async () => {
    const result = await decode({ kind: "7715-request", params: [baseRequest] });
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]!.standard).toBe("7715");
    expect(result.findings.find((f) => f.ruleId === "PL-7715-002")).toBeUndefined();
  });

  it("fires PL-7715-002 when there's no expiry rule", async () => {
    const result = await decode({ kind: "7715-request", params: [{ ...baseRequest, rules: [] }] });
    expect(result.findings.find((f) => f.ruleId === "PL-7715-002")).toBeDefined();
  });

  it("fires PL-7715-001 for an unrecognized permission type", async () => {
    const result = await decode({
      kind: "7715-request",
      params: [{ ...baseRequest, permission: { ...baseRequest.permission, type: "some-future-type" } }],
    });
    expect(result.findings.find((f) => f.ruleId === "PL-7715-001")).toBeDefined();
  });

  it("fires PL-7715-004 when isAdjustmentAllowed is false", async () => {
    const result = await decode({
      kind: "7715-request",
      params: [{ ...baseRequest, permission: { ...baseRequest.permission, isAdjustmentAllowed: false } }],
    });
    expect(result.findings.find((f) => f.ruleId === "PL-7715-004")).toBeDefined();
  });
});

describe("decode() — ERC-7715 response", () => {
  const baseRequest = {
    chainId: toHex(1),
    from: DELEGATOR.address,
    to: SESSION_KEY,
    permission: { type: "erc20-token-allowance", isAdjustmentAllowed: true, data: { tokenAddress: USDC, allowanceAmount: toHex(1000n) } },
    rules: [{ type: "expiry", data: { timestamp: 9_999_999_999 } }],
  };

  it("decodes context into children and doesn't fire PL-7715-003 when the delegation matches the request", async () => {
    const context = await buildEncodedContext([
      { enforcer: ERC20_TRANSFER_AMOUNT_ENFORCER, terms: concat([USDC, pad(numberToHex(1000n), { size: 32 })]) },
      { enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) },
    ]);

    const result = await decode(
      { kind: "7715-response", params: [{ ...baseRequest, context, dependencies: [], delegationManager: DELEGATION_MANAGER }] },
      { registry: FULL_REGISTRY },
    );

    const responseGrant = result.grants.find((g) => g.standard === "7715");
    expect(responseGrant?.children).toHaveLength(1);
    expect(result.grants).toHaveLength(2); // the 7715 wrapper + its one 7710 child
    expect(result.findings.find((f) => f.ruleId === "PL-7715-003")).toBeUndefined();
    // the child delegation itself should also be evaluated by 7710 rules:
    expect(result.findings.find((f) => f.ruleId === "PL-7710-005")).toBeUndefined();
  });

  it("fires PL-7715-003 critical when the granted delegation has no caveats at all", async () => {
    const context = await buildEncodedContext([]);

    const result = await decode(
      { kind: "7715-response", params: [{ ...baseRequest, context, dependencies: [], delegationManager: DELEGATION_MANAGER }] },
      { registry: FULL_REGISTRY },
    );

    const finding = result.findings.find((f) => f.ruleId === "PL-7715-003");
    expect(finding?.severity).toBe("critical");
    expect(finding?.evidence.missing).toEqual(expect.arrayContaining(["an amount/rate limit", "the requested expiry"]));

    // and the child grant itself should independently trip PL-7710-001 (no caveats):
    expect(result.findings.find((f) => f.ruleId === "PL-7710-001")).toBeDefined();
  });

  it("fires PL-7715-005 when the delegationManager is unrecognized, and not when it is", async () => {
    const context = await buildEncodedContext([{ enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) }]);
    const params = [{ ...baseRequest, context, dependencies: [], delegationManager: DELEGATION_MANAGER }];

    const unregistered = await decode({ kind: "7715-response", params }, { registry: registry([]) });
    expect(unregistered.findings.find((f) => f.ruleId === "PL-7715-005")).toBeDefined();

    const registered = await decode({ kind: "7715-response", params }, { registry: FULL_REGISTRY });
    expect(registered.findings.find((f) => f.ruleId === "PL-7715-005")).toBeUndefined();
  });
});
