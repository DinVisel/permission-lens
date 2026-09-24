import { describe, expect, it } from "vitest";
import { keccak256 } from "viem";
import type { Hex } from "viem";
import { computeCodehash, computeNormalizedCodehash, maskPush20Constants, stripMetadata } from "./codehash.js";

describe("stripMetadata", () => {
  it("strips a trailing CBOR section given its 2-byte big-endian length", () => {
    const code = "0x6001600201";
    const cbor = "a2646970667358221220aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa64736f6c63430008190033";
    const cborLength = cbor.length / 2;
    const lengthSuffix = cborLength.toString(16).padStart(4, "0");
    const bytecode = (code + cbor + lengthSuffix) as Hex;

    expect(stripMetadata(bytecode)).toBe(code);
  });

  it("leaves bytecode unchanged when there's no plausible metadata section", () => {
    const bytecode: Hex = "0x600160020000";
    expect(stripMetadata(bytecode)).toBe(bytecode);
  });

  it("leaves very short bytecode unchanged", () => {
    const bytecode: Hex = "0x60";
    expect(stripMetadata(bytecode)).toBe(bytecode);
  });
});

describe("maskPush20Constants", () => {
  it("zeroes a PUSH20 immediate but leaves other pushes untouched", () => {
    // PUSH1 0x99, PUSH20 <20 bytes of 0x11>, PUSH2 0xaabb, STOP
    const address = "11".repeat(20);
    const bytecode = `0x6099${"73"}${address}${"61"}aabb00` as Hex;

    const masked = maskPush20Constants(bytecode);

    expect(masked).toBe(`0x6099${"73"}${"00".repeat(20)}${"61"}aabb00`);
  });

  it("does not desync when a push's immediate bytes look like another PUSH opcode", () => {
    // PUSH2 0x7301 ("73" — the PUSH20 opcode byte — appears INSIDE this push's
    // immediate data, not as a real instruction), then PUSH20 <20 bytes of 0x22>.
    const address = "22".repeat(20);
    const bytecode = `0x617301${"73"}${address}` as Hex;

    const masked = maskPush20Constants(bytecode);

    // The embedded "73" byte must be left alone (it's data, not an opcode);
    // only the real PUSH20 that follows gets masked.
    expect(masked).toBe(`0x617301${"73"}${"00".repeat(20)}`);
  });

  it("handles PUSH20 as the last instruction (immediate cut off by array end) without throwing", () => {
    const bytecode = `0x73${"33".repeat(10)}` as Hex; // truncated — only 10 of 20 bytes present
    expect(() => maskPush20Constants(bytecode)).not.toThrow();
  });
});

describe("computeCodehash / computeNormalizedCodehash", () => {
  it("computeCodehash is plain keccak256 of the input", () => {
    const bytecode: Hex = "0x600160020000";
    expect(computeCodehash(bytecode)).toBe(keccak256(bytecode));
  });

  it("normalizedCodehash is identical for two deployments differing only in their PUSH20 constant", () => {
    const template = (addr: string) => `0x6020600060003960206000f373${addr}00` as Hex;
    const a = template("11".repeat(20));
    const b = template("22".repeat(20));

    expect(computeNormalizedCodehash(a)).toBe(computeNormalizedCodehash(b));
    expect(computeCodehash(a)).not.toBe(computeCodehash(b));
  });

  it("normalizedCodehash differs when the surrounding logic differs, not just the address", () => {
    const a = `0x60206000600039602060` as Hex;
    const b = `0x60106000600039601060` as Hex;
    expect(computeNormalizedCodehash(a)).not.toBe(computeNormalizedCodehash(b));
  });
});
