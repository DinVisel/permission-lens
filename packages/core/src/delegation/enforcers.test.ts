import { describe, expect, it } from "vitest";
import { concat, getAddress, numberToHex, pad } from "viem";
import type { Hex } from "viem";
import {
  EnforcerTermsError,
  decodeAllowedMethodsTerms,
  decodeAllowedTargetsTerms,
  decodeErc20TransferAmountTerms,
  decodeLimitedCallsTerms,
  decodeNativeTokenTransferAmountTerms,
  decodeRedeemerTerms,
  decodeTimestampTerms,
  decodeValueLteTerms,
} from "./enforcers.js";

const ADDR_A = "0x111111111111111111111111111111111111111a" as const;
const ADDR_B = "0x222222222222222222222222222222222222222b" as const;

describe("decodeTimestampTerms", () => {
  it("decodes after and before from a 32-byte uint128 pair", () => {
    const after = pad(numberToHex(1000n), { size: 16 });
    const before = pad(numberToHex(2000n), { size: 16 });
    const terms = concat([after, before]);
    expect(decodeTimestampTerms(terms)).toEqual({ type: "time", after: 1000, before: 2000 });
  });

  it("treats 0 on either side as unbounded", () => {
    const after = pad(numberToHex(0n), { size: 16 });
    const before = pad(numberToHex(5000n), { size: 16 });
    expect(decodeTimestampTerms(concat([after, before]))).toEqual({ type: "time", before: 5000 });
  });

  it("throws on the wrong length", () => {
    expect(() => decodeTimestampTerms("0x1234" as Hex)).toThrow(EnforcerTermsError);
  });
});

describe("decodeAllowedTargetsTerms / decodeRedeemerTerms", () => {
  it("decodes N x 20-byte addresses", () => {
    const terms = concat([ADDR_A, ADDR_B]) as Hex;
    const checksummed = [getAddress(ADDR_A), getAddress(ADDR_B)];
    expect(decodeAllowedTargetsTerms(terms)).toEqual({ type: "targets", addresses: checksummed });
    expect(decodeRedeemerTerms(terms)).toEqual({ type: "redeemers", addresses: checksummed });
  });

  it("throws when the length isn't a multiple of 20", () => {
    expect(() => decodeAllowedTargetsTerms("0x1234" as Hex)).toThrow(EnforcerTermsError);
  });

  it("throws on empty terms", () => {
    expect(() => decodeAllowedTargetsTerms("0x" as Hex)).toThrow(EnforcerTermsError);
  });
});

describe("decodeAllowedMethodsTerms", () => {
  it("decodes N x 4-byte selectors", () => {
    const terms = "0xa9059cbb095ea7b3" as Hex; // transfer(...) + approve(...) selectors back to back
    expect(decodeAllowedMethodsTerms(terms)).toEqual({ type: "methods", selectors: ["0xa9059cbb", "0x095ea7b3"] });
  });
});

describe("decodeValueLteTerms / decodeNativeTokenTransferAmountTerms / decodeLimitedCallsTerms", () => {
  const terms = pad(numberToHex(1_000_000n), { size: 32 });

  it("decodeValueLteTerms reads a uint256 max-per-call", () => {
    expect(decodeValueLteTerms(terms)).toEqual({ type: "value-per-call", maxWei: 1_000_000n });
  });

  it("decodeNativeTokenTransferAmountTerms reads a uint256 total cap", () => {
    expect(decodeNativeTokenTransferAmountTerms(terms)).toEqual({ type: "native-total", maxWei: 1_000_000n });
  });

  it("decodeLimitedCallsTerms reads a uint256 call-count cap", () => {
    expect(decodeLimitedCallsTerms(terms)).toEqual({ type: "calls", max: 1_000_000n });
  });
});

describe("decodeErc20TransferAmountTerms", () => {
  it("decodes 52 bytes: address token || uint256 max", () => {
    const max = pad(numberToHex(500n), { size: 32 });
    const terms = concat([ADDR_A, max]) as Hex;
    expect(decodeErc20TransferAmountTerms(terms)).toEqual({ type: "erc20-total", token: getAddress(ADDR_A), max: 500n });
  });

  it("throws on the wrong length", () => {
    expect(() => decodeErc20TransferAmountTerms(ADDR_A)).toThrow(EnforcerTermsError);
  });
});
