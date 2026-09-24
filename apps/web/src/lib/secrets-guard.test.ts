import { describe, expect, it } from "vitest";
import { detectPastedSecret } from "./secrets-guard.js";

const VALID_MNEMONIC_12 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const VALID_MNEMONIC_24 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

describe("detectPastedSecret", () => {
  it("flags a 0x-prefixed 64-hex private key", () => {
    const match = detectPastedSecret(`0x${"a".repeat(64)}`);
    expect(match?.kind).toBe("private-key");
  });

  it("flags a bare 64-hex private key", () => {
    const match = detectPastedSecret("a".repeat(64));
    expect(match?.kind).toBe("private-key");
  });

  it("flags a valid 12-word BIP-39 mnemonic", () => {
    expect(detectPastedSecret(VALID_MNEMONIC_12)?.kind).toBe("seed-phrase");
  });

  it("flags a valid 24-word BIP-39 mnemonic", () => {
    expect(detectPastedSecret(VALID_MNEMONIC_24)?.kind).toBe("seed-phrase");
  });

  it("does not flag 12 arbitrary words that aren't a valid mnemonic", () => {
    const notAMnemonic = "the quick brown fox jumps over the lazy dog and runs away fast";
    expect(detectPastedSecret(notAMnemonic)).toBeNull();
  });

  it("does not flag an ordinary GrantInput JSON payload, even though r/s are 64-hex", () => {
    const input = JSON.stringify({
      kind: "7702-authorization",
      authorization: { chainId: 1, address: `0x${"1".repeat(40)}`, nonce: 0, r: `0x${"2".repeat(64)}`, s: `0x${"3".repeat(64)}`, v: 27 },
    });
    expect(detectPastedSecret(input)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectPastedSecret("")).toBeNull();
    expect(detectPastedSecret("   ")).toBeNull();
  });
});
