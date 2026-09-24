import { keccak256 } from "viem";
import type { Hex } from "viem";

/**
 * Strips the trailing CBOR metadata section Solidity appends to runtime
 * bytecode (a Sourcify/Etherscan-style heuristic, IMPLEMENTATION_PLAN.md
 * §7.4): the last 2 bytes encode the CBOR section's length as a big-endian
 * uint16, so `bytecode[0 .. len - 2 - cborLength]` is the "real" code.
 *
 * This is a heuristic, not a parser — it trusts the length field rather
 * than validating the CBOR itself. A contract compiled with
 * `--metadata-hash none` or in a language that doesn't append this trailer
 * has nothing to strip; in that case (or if the length field doesn't fit
 * the bytecode) the input is returned unchanged.
 */
export function stripMetadata(bytecode: Hex): Hex {
  const bytes = hexToBytes(bytecode);
  if (bytes.length < 2) return bytecode;

  const cborLength = (bytes[bytes.length - 2]! << 8) | bytes[bytes.length - 1]!;
  const trimmedLength = bytes.length - 2 - cborLength;
  if (cborLength === 0 || trimmedLength <= 0) return bytecode;

  return bytesToHex(bytes.subarray(0, trimmedLength));
}

const PUSH1 = 0x60;
const PUSH32 = 0x7f;
const PUSH20 = 0x73;

/**
 * Zeroes out every PUSH20 immediate (a full 20-byte constant — the natural
 * width for a hardcoded `address`) so two delegates that differ only in an
 * embedded address (e.g. a sweeper cloned with a different collector) hash
 * identically. This is `normalizedCodehash` from IMPLEMENTATION_PLAN.md
 * §7.1/§7.4 ("mask PUSH20 constants").
 *
 * Correctly walks the instruction stream — PUSH1..PUSH32 (0x60-0x7f) each
 * carry 1..32 bytes of immediate data that must be skipped as data, not
 * misread as further opcodes, or the scan desyncs on any bytecode
 * containing a push whose immediate bytes happen to look like an opcode.
 */
export function maskPush20Constants(bytecode: Hex): Hex {
  const bytes = hexToBytes(bytecode);
  const out = bytes.slice();

  let i = 0;
  while (i < out.length) {
    const opcode = out[i]!;
    if (opcode >= PUSH1 && opcode <= PUSH32) {
      const size = opcode - PUSH1 + 1;
      if (opcode === PUSH20) {
        for (let j = i + 1; j <= i + size && j < out.length; j++) out[j] = 0;
      }
      i += 1 + size;
    } else {
      i += 1;
    }
  }

  return bytesToHex(out);
}

/** `keccak256(runtime code)`, unmodified — IMPLEMENTATION_PLAN.md §7.1's `codehash` field. */
export function computeCodehash(bytecode: Hex): Hex {
  return keccak256(bytecode);
}

/** `keccak256` of the metadata-stripped, PUSH20-masked code — §7.1's `normalizedCodehash`. */
export function computeNormalizedCodehash(bytecode: Hex): Hex {
  return keccak256(maskPush20Constants(stripMetadata(bytecode)));
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): Hex {
  let out = "0x";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out as Hex;
}
