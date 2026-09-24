import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { concat, keccak256, numberToHex, toRlp } from "viem";
import type { Address } from "viem";
import { hashAuthorization as viemHashAuthorization } from "viem/utils";
import { hashAuthorization as ourHashAuthorization, isLowS, normalizeAuthorization } from "./authorization.js";

const SAMPLE_ADDRESS: Address = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";

describe("hashAuthorization", () => {
  it("matches viem's hashAuthorization (LEARNING.md §5.2)", () => {
    const auth = { chainId: 1n, address: SAMPLE_ADDRESS, nonce: 7n };
    expect(ourHashAuthorization(auth)).toBe(viemHashAuthorization({ chainId: 1, address: SAMPLE_ADDRESS, nonce: 7 }));
  });

  it("matches viem across random chainId/address/nonce (property test, 1000 runs)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 2 ** 32 }),
        fc.nat({ max: Number.MAX_SAFE_INTEGER }),
        fc.hexaString({ minLength: 40, maxLength: 40 }),
        (chainId, nonce, addrHex) => {
          const address = `0x${addrHex}` as Address;
          const ours = ourHashAuthorization({ chainId: BigInt(chainId), address, nonce: BigInt(nonce) });
          const theirs = viemHashAuthorization({ chainId, address, nonce });
          expect(ours).toBe(theirs);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("chainId = 0 and nonce = 0 (the all-chains, first-use case) matches viem", () => {
    const auth = { chainId: 0n, address: SAMPLE_ADDRESS, nonce: 0n };
    expect(ourHashAuthorization(auth)).toBe(viemHashAuthorization({ chainId: 0, address: SAMPLE_ADDRESS, nonce: 0 }));
  });

  it("Lab 6 regression: encoding nonce=0 as 0x00 instead of the empty string produces a different digest", () => {
    const correct = ourHashAuthorization({ chainId: 1n, address: SAMPLE_ADDRESS, nonce: 0n });

    // Deliberately broken: encode 0 as a literal 0x00 byte instead of RLP's empty string.
    const broken = keccak256(
      concat(["0x05", toRlp([numberToHex(1n), SAMPLE_ADDRESS, "0x00"])]),
    );

    expect(broken).not.toBe(correct);
  });
});

describe("normalizeAuthorization", () => {
  it("accepts `address`", () => {
    const normalized = normalizeAuthorization({ chainId: 1, address: SAMPLE_ADDRESS, nonce: 0 });
    expect(normalized.address).toBe(SAMPLE_ADDRESS);
  });

  it("accepts `contractAddress` as an alias", () => {
    const normalized = normalizeAuthorization({ chainId: 1, contractAddress: SAMPLE_ADDRESS, nonce: 0 });
    expect(normalized.address).toBe(SAMPLE_ADDRESS);
  });

  it("throws when neither is present", () => {
    expect(() => normalizeAuthorization({ chainId: 1, nonce: 0 })).toThrow();
  });
});

describe("isLowS", () => {
  it("accepts s at exactly n/2", () => {
    expect(isLowS("0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0")).toBe(true);
  });

  it("rejects s one above n/2", () => {
    expect(isLowS("0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a1")).toBe(false);
  });
});
