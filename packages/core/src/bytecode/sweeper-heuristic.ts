import type { Address, Hex } from "viem";

const PUSH1 = 0x60;
const PUSH32 = 0x7f;
const PUSH20 = 0x73;
const CALL = 0xf1;
const CALLCODE = 0xf2;
const DELEGATECALL = 0xf4;
const STATICCALL = 0xfa;
const SELFDESTRUCT = 0xff;
const VALUE_TRANSFER_OPCODES = new Set([CALL, CALLCODE, DELEGATECALL, STATICCALL, SELFDESTRUCT]);

/**
 * How many *bytes* after a PUSH20's immediate data we'll still count as
 * "related to" it. Solidity's codegen for an external call on an `address`
 * typically inserts an AND-mask (a second PUSH20 + AND) and a gas-stipend
 * push between the address and the actual CALL — empirically ~20 bytes for
 * `payable(addr).transfer(...)` (see sweeper-heuristic.test.ts's real
 * SweeperDelegate fixture). Wide enough to survive that, narrow enough to
 * stay a "the address feeds this call" heuristic rather than "an address
 * exists somewhere near a call".
 */
const PROXIMITY_WINDOW = 48;

export interface SweeperHeuristicMatch {
  matched: boolean;
  /** The hardcoded address the heuristic thinks funds are swept to, when matched. */
  address?: Address;
  confidence: "heuristic";
}

/**
 * PL-7702-011's "crude sweeper heuristic" (LEARNING.md §10.3): flags code
 * that pushes a full 20-byte hardcoded address and, within a short
 * instruction window, executes a value-transfer-capable opcode
 * (CALL/CALLCODE/DELEGATECALL/STATICCALL/SELFDESTRUCT). A real attacker's
 * collector address is effectively random, so it's always pushed via
 * PUSH20 — unlike a small/memorable constant, which the compiler would
 * shrink to a narrower PUSH.
 *
 * This is intentionally imprecise. Plenty of legitimate contracts push a
 * hardcoded address before a call (an oracle, a fixed router, a treasury).
 * It exists to surface candidates for a human/registry review
 * (`confidence: "heuristic"`, never `"certain"`), not to convict on its own
 * — see IMPLEMENTATION_PLAN.md §6.1/§10.3 and the "never say safe" /
 * "unknown means unknown" rules in §8.
 */
export function crudeSweeperHeuristic(bytecode: Hex): SweeperHeuristicMatch {
  const bytes = hexToBytes(bytecode);

  let i = 0;
  let pendingAddress: { value: Uint8Array; expiresAt: number } | undefined;

  while (i < bytes.length) {
    const opcode = bytes[i]!;

    if (pendingAddress && i > pendingAddress.expiresAt) {
      pendingAddress = undefined;
    }

    if (opcode >= PUSH1 && opcode <= PUSH32) {
      const size = opcode - PUSH1 + 1;
      if (opcode === PUSH20) {
        const value = bytes.slice(i + 1, i + 1 + size);
        if (!isTrivial(value)) {
          pendingAddress = { value, expiresAt: i + 1 + size + PROXIMITY_WINDOW };
        }
      }
      i += 1 + size;
      continue;
    }

    if (VALUE_TRANSFER_OPCODES.has(opcode) && pendingAddress) {
      return { matched: true, address: bytesToAddress(pendingAddress.value), confidence: "heuristic" };
    }

    i += 1;
  }

  return { matched: false, confidence: "heuristic" };
}

/** Rejects the zero address and address(1)/address(type(uint160).max)-style sentinels — never plausible sweep targets, but common as unrelated bit-masks or precompile references. */
function isTrivial(value: Uint8Array): boolean {
  const allZero = value.every((b) => b === 0);
  const allOnes = value.every((b) => b === 0xff);
  let nonZeroCount = 0;
  for (const b of value) if (b !== 0) nonZeroCount++;
  return allZero || allOnes || nonZeroCount <= 1;
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToAddress(bytes: Uint8Array): Address {
  let out = "0x";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out as Address;
}
