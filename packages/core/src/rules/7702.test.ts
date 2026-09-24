import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { runRules } from "./runner.js";
import { rules7702 } from "./7702.js";
import type { Grant } from "../types.js";
import type { RegistryLookup } from "../registry-types.js";

const DELEGATE: Address = "0x0000000000000000000000000000000000d31347";

// Real compiled bytecode, same as packages/core/src/bytecode/sweeper-heuristic.test.ts —
// see that file for provenance.
const SWEEPER_BYTECODE: Hex =
  "0x608060405260043610610021575f3560e01c80633cbadf781461003a57610030565b366100305761002e610064565b005b610038610064565b005b348015610045575f5ffd5b5061004e6100cc565b60405161005b9190610123565b60405180910390f35b5f4790505f8111156100c957731337c0ffee1337c0ffee1337c0ffee1337c0ffee73ffffffffffffffffffffffffffffffffffffffff166108fc8290811502906040515f60405180830381858888f193505050501580156100c7573d5f5f3e3d5ffd5b505b50565b731337c0ffee1337c0ffee1337c0ffee1337c0ffee81565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61010d826100e4565b9050919050565b61011d81610103565b82525050565b5f6020820190506101365f830184610114565b9291505056fea26469706673582212202193eae523fa83402771bcd0a02c87c56a04f46fd24bd84fcd2c8901425de10c64736f6c63430008250033";

const BENIGN_BYTECODE: Hex = "0x60806040523415600e575f5ffd5b505f80fd";

function baseGrant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: "0xtest",
    standard: "7702",
    grantor: "0x000000000000000000000000000000000000A1",
    grantee: { type: "code", address: DELEGATE },
    chains: { type: "list", chainIds: [1] },
    scope: { type: "full-account" },
    validity: {},
    replay: { nonce: 5n },
    revocation: { method: "revoke", onchain: true },
    facts: {},
    source: { input: { kind: "7702-authorization", authorization: { chainId: 1, address: DELEGATE, nonce: 5 } }, path: "[0]" },
    ...overrides,
  };
}

function run(grant: Grant, registry?: RegistryLookup) {
  return runRules([grant], rules7702, { registry });
}

describe("PL-7702-002 — known-malicious registry match", () => {
  it("fires critical when the registry marks the delegate malicious", () => {
    const grant = baseGrant({ facts: { registryStatus: "malicious", registryName: "Evil Cluster #4" } });
    const { findings } = run(grant);
    const finding = findings.find((f) => f.ruleId === "PL-7702-002");
    expect(finding?.severity).toBe("critical");
  });

  it("does not fire for a recognized or unlisted delegate", () => {
    const recognized = baseGrant({ facts: { registryStatus: "recognized" } });
    expect(run(recognized).findings.find((f) => f.ruleId === "PL-7702-002")).toBeUndefined();
  });
});

describe("PL-7702-006 — no code at the delegate", () => {
  it("fires high when codeAt is empty", () => {
    const grant = baseGrant({ facts: { codeAt: "0x" } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-006");
    expect(finding?.severity).toBe("high");
  });

  it("does not fire when code is present", () => {
    const grant = baseGrant({ facts: { codeAt: BENIGN_BYTECODE } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-006")).toBeUndefined();
  });

  it("is not checked when codeAt is unknown", () => {
    const grant = baseGrant();
    const { notChecked } = run(grant);
    expect(notChecked.find((n) => n.ruleId === "PL-7702-006")).toBeDefined();
  });
});

describe("PL-7702-007 — proxy delegate", () => {
  it("fires medium when isProxy is true", () => {
    const grant = baseGrant({ facts: { isProxy: true, proxyImplementation: "0x000000000000000000000000000000000000b2" } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-007");
    expect(finding?.severity).toBe("medium");
    expect(finding?.detail).toContain("0x000000000000000000000000000000000000b2");
  });

  it("does not fire when isProxy is false", () => {
    const grant = baseGrant({ facts: { isProxy: false } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-007")).toBeUndefined();
  });
});

describe("PL-7702-009 / PL-7702-010 — nonce vs. current account nonce", () => {
  it("PL-7702-009 fires medium when the tuple nonce is more than 1 ahead", () => {
    const grant = baseGrant({ replay: { nonce: 10n }, facts: { currentNonce: 2n } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-009");
    expect(finding?.severity).toBe("medium");
  });

  it("PL-7702-009 does not fire for current+1 (the ordinary self-sponsored case)", () => {
    const grant = baseGrant({ replay: { nonce: 3n }, facts: { currentNonce: 2n } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-009")).toBeUndefined();
  });

  it("PL-7702-010 fires info when the tuple nonce is already behind", () => {
    const grant = baseGrant({ replay: { nonce: 1n }, facts: { currentNonce: 5n } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-010");
    expect(finding?.severity).toBe("info");
  });

  it("neither fires when the nonce matches exactly", () => {
    const grant = baseGrant({ replay: { nonce: 5n }, facts: { currentNonce: 5n } });
    const { findings } = run(grant);
    expect(findings.find((f) => f.ruleId === "PL-7702-009")).toBeUndefined();
    expect(findings.find((f) => f.ruleId === "PL-7702-010")).toBeUndefined();
  });
});

describe("PL-7702-011 — sweeper heuristic", () => {
  it("fires critical/heuristic against real sweeper bytecode", () => {
    const grant = baseGrant({ facts: { codeAt: SWEEPER_BYTECODE } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-011");
    expect(finding?.severity).toBe("critical");
    expect(finding?.confidence).toBe("heuristic");
    expect(finding?.evidence.sweepTarget).toBe("0x1337c0ffee1337c0ffee1337c0ffee1337c0ffee");
  });

  it("does not fire against benign bytecode", () => {
    const grant = baseGrant({ facts: { codeAt: BENIGN_BYTECODE } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-011")).toBeUndefined();
  });
});

describe("PL-7702-015 — registry-flagged init/storage risk", () => {
  it("fires medium for unprotected initialization", () => {
    const grant = baseGrant({ facts: { registryInitialization: "unprotected" } });
    const finding = run(grant).findings.find((f) => f.ruleId === "PL-7702-015");
    expect(finding?.severity).toBe("medium");
    expect(finding?.detail).toContain("front-running");
  });

  it("fires for plain (non-namespaced) storage", () => {
    const grant = baseGrant({ facts: { registryStorage: "plain" } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-015")).toBeDefined();
  });

  it("does not fire for a clean registry entry (signed init, erc7201 storage)", () => {
    const grant = baseGrant({ facts: { registryInitialization: "signed", registryStorage: "erc7201" } });
    expect(run(grant).findings.find((f) => f.ruleId === "PL-7702-015")).toBeUndefined();
  });
});
