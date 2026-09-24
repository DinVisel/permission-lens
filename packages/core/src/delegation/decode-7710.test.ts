import { describe, expect, it } from "vitest";
import { privateKeyToAccount, signTypedData } from "viem/accounts";
import { concat, numberToHex, pad } from "viem";
import type { Address, Hex, TypedDataDomain } from "viem";
import { decode } from "../decode.js";
import { ANY_DELEGATE, DELEGATION_TYPES, ROOT_AUTHORITY } from "./constants.js";
import { hashDelegation, linkRedelegationChain, grantFrom7710Delegation } from "./from-7710.js";
import type { DelegationLike } from "./types.js";
import type { RegistryEntry, RegistryLookup } from "../registry-types.js";

const TEST_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DELEGATOR = privateKeyToAccount(TEST_PRIVATE_KEY);
const DELEGATE: Address = "0x0000000000000000000000000000000005e55104"; // a session key / delegate account — arbitrary, not a real deployment
const DELEGATION_MANAGER: Address = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";
const TIMESTAMP_ENFORCER: Address = "0x1046bb45C8d673d4ea75321280DB34899413c069";
const ALLOWED_TARGETS_ENFORCER: Address = "0x7F20f61b1f09b08D970938F6fa563634d65c4EeB";
const UNKNOWN_ENFORCER: Address = "0x00000000000000000000000000000000000000e5";

const DOMAIN: TypedDataDomain = { name: "DelegationManager", version: "1", chainId: 1, verifyingContract: DELEGATION_MANAGER };

class StubRegistry implements RegistryLookup {
  constructor(private entries: Map<string, RegistryEntry>) {}
  lookupAddress(address: Address): RegistryEntry | null {
    return this.entries.get(address.toLowerCase()) ?? null;
  }
}

function registry(entries: [Address, RegistryEntry][]): StubRegistry {
  return new StubRegistry(new Map(entries.map(([a, e]) => [a.toLowerCase(), e])));
}

const delegationManagerEntry: RegistryEntry = { name: "MetaMask DelegationManager", status: "recognized", kind: "delegation-manager" };
const timestampEnforcerEntry: RegistryEntry = { name: "TimestampEnforcer", status: "recognized", kind: "caveat-enforcer", decoder: "metamask/timestamp@1" };
const allowedTargetsEnforcerEntry: RegistryEntry = { name: "AllowedTargetsEnforcer", status: "recognized", kind: "caveat-enforcer", decoder: "metamask/allowed-targets@1" };

async function signDelegation(delegation: Omit<DelegationLike, "signature">, domain: TypedDataDomain = DOMAIN): Promise<DelegationLike> {
  const signature = await signTypedData({
    privateKey: TEST_PRIVATE_KEY,
    domain,
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message: {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: delegation.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: BigInt(delegation.salt),
    },
  });
  return { ...delegation, signature };
}

function timestampTerms(after: bigint, before: bigint): Hex {
  return concat([pad(numberToHex(after), { size: 16 }), pad(numberToHex(before), { size: 16 })]);
}

describe("decode() — ERC-7710 delegation", () => {
  it("no caveats: recovers grantor/grantee and fires PL-7710-001 critical", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [],
      salt: 0n,
    });

    const result = await decode({ kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } });

    expect(result.grants).toHaveLength(1);
    const grant = result.grants[0]!;
    expect(grant.standard).toBe("7710");
    expect(grant.grantor?.toLowerCase()).toBe(DELEGATOR.address.toLowerCase());
    expect(grant.grantee).toEqual({ type: "account", address: DELEGATE });
    expect(grant.scope.type).toBe("full-account");

    const finding = result.findings.find((f) => f.ruleId === "PL-7710-001");
    expect(finding?.severity).toBe("critical");
  });

  it("delegate == ANY_DELEGATE fires PL-7710-002", async () => {
    const delegation = await signDelegation({
      delegate: ANY_DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [{ enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) }],
      salt: 1n,
    });

    const result = await decode({ kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } });

    expect(result.grants[0]!.grantee).toEqual({ type: "anyone" });
    expect(result.findings.find((f) => f.ruleId === "PL-7710-002")).toBeDefined();
  });

  it("decodes a recognized TimestampEnforcer caveat and doesn't fire PL-7710-003/004", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [{ enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) }],
      salt: 2n,
    });

    const result = await decode(
      { kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } },
      { registry: registry([[TIMESTAMP_ENFORCER, timestampEnforcerEntry]]) },
    );

    const grant = result.grants[0]!;
    expect(grant.scope).toEqual({ type: "restricted", restrictions: [{ type: "time", before: 9_999_999_999 }] });
    expect(result.findings.find((f) => f.ruleId === "PL-7710-003")).toBeUndefined();
    expect(result.findings.find((f) => f.ruleId === "PL-7710-004")).toBeUndefined();
  });

  it("an unrecognized enforcer decodes as `unrecognized` and fires PL-7710-004/005", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [{ enforcer: UNKNOWN_ENFORCER, terms: "0xdeadbeef" }],
      salt: 3n,
    });

    const result = await decode({ kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } });

    const grant = result.grants[0]!;
    expect(grant.scope).toEqual({ type: "restricted", restrictions: [{ type: "unrecognized", enforcer: UNKNOWN_ENFORCER, terms: "0xdeadbeef" }] });
    expect(result.findings.find((f) => f.ruleId === "PL-7710-004")).toBeDefined();
    expect(result.findings.find((f) => f.ruleId === "PL-7710-005")).toBeDefined();
  });

  it("no value limit and no target restriction fires PL-7710-005 even with a time bound present", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [{ enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) }],
      salt: 4n,
    });

    const result = await decode(
      { kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } },
      { registry: registry([[TIMESTAMP_ENFORCER, timestampEnforcerEntry]]) },
    );

    expect(result.findings.find((f) => f.ruleId === "PL-7710-005")).toBeDefined();
  });

  it("a target restriction + value limit avoids PL-7710-005", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [
        { enforcer: ALLOWED_TARGETS_ENFORCER, terms: DELEGATE },
        { enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms(0n, 9_999_999_999n) },
      ],
      salt: 5n,
    });

    const result = await decode(
      { kind: "typed-data", typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } },
      { registry: registry([[TIMESTAMP_ENFORCER, timestampEnforcerEntry], [ALLOWED_TARGETS_ENFORCER, allowedTargetsEnforcerEntry]]) },
    );

    expect(result.findings.find((f) => f.ruleId === "PL-7710-005")).toBeUndefined();
  });

  it("fires PL-7710-008 when the DelegationManager isn't registered, and not when it is", async () => {
    const delegation = await signDelegation({
      delegate: DELEGATE,
      delegator: DELEGATOR.address,
      authority: ROOT_AUTHORITY,
      caveats: [],
      salt: 6n,
    });
    const input = { kind: "typed-data" as const, typedData: { domain: DOMAIN, types: DELEGATION_TYPES, primaryType: "Delegation", message: delegation } };

    const unregistered = await decode(input, { registry: registry([]) });
    expect(unregistered.findings.find((f) => f.ruleId === "PL-7710-008")).toBeDefined();

    const registered = await decode(input, { registry: registry([[DELEGATION_MANAGER, delegationManagerEntry]]) });
    expect(registered.findings.find((f) => f.ruleId === "PL-7710-008")).toBeUndefined();

    const notChecked = (await decode(input)).notChecked.find((n) => n.ruleId === "PL-7710-008");
    expect(notChecked).toBeDefined();
  });

  it("rejects a typed-data payload with the wrong domain", async () => {
    const wrongDomain: TypedDataDomain = { name: "NotDelegationManager", version: "1" };
    const result = await decode({ kind: "typed-data", typedData: { domain: wrongDomain, types: DELEGATION_TYPES, primaryType: "Delegation", message: {} } });
    expect(result.unsupported).toBeDefined();
  });
});

describe("linkRedelegationChain", () => {
  it("links parent/children when the whole chain is provided, and flags a missing parent otherwise", () => {
    const root: DelegationLike = { delegate: DELEGATE, delegator: DELEGATOR.address, authority: ROOT_AUTHORITY, caveats: [], salt: 10n };
    const rootGrant = grantFrom7710Delegation(root, { domain: DOMAIN, path: "[0]", input: { kind: "typed-data", typedData: null } });
    const rootHash = hashDelegation(root, DOMAIN);

    const child: DelegationLike = { delegate: "0x00000000000000000000000000000000000000c1", delegator: DELEGATE, authority: rootHash, caveats: [], salt: 11n };
    const childGrant = grantFrom7710Delegation(child, { domain: DOMAIN, path: "[1]", input: { kind: "typed-data", typedData: null } });

    const linked = linkRedelegationChain([rootGrant, childGrant]);
    expect(linked[1]!.parent).toBe(linked[0]);
    expect(linked[0]!.children).toEqual([linked[1]]);

    const orphan = grantFrom7710Delegation(child, { domain: DOMAIN, path: "[0]", input: { kind: "typed-data", typedData: null } });
    const [linkedOrphan] = linkRedelegationChain([orphan]);
    expect(linkedOrphan!.parent).toBeUndefined();
    expect(linkedOrphan!.facts.parentUnresolved).toBe(true);
  });
});
