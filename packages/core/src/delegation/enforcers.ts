import { getAddress, hexToBigInt, size, slice } from "viem";
import type { Hex } from "viem";
import type { Restriction } from "../types.js";

export class EnforcerTermsError extends Error {}

/**
 * `terms` layouts read from MetaMask's `delegation-framework` source
 * (LEARNING.md §7.3). Each decoder is pure — no chain access — and throws
 * `EnforcerTermsError` on a length mismatch rather than guessing, so a
 * malformed `terms` blob surfaces as a decode failure instead of silently
 * producing a wrong restriction.
 */
export type EnforcerDecoder = (terms: Hex) => Restriction;

function requireSize(terms: Hex, bytes: number, label: string): void {
  if (size(terms) !== bytes) {
    throw new EnforcerTermsError(`${label}: expected ${bytes}-byte terms, got ${size(terms)}`);
  }
}

function requireMultipleOf(terms: Hex, unit: number, label: string): void {
  if (size(terms) === 0 || size(terms) % unit !== 0) {
    throw new EnforcerTermsError(`${label}: expected terms to be a non-zero multiple of ${unit} bytes, got ${size(terms)}`);
  }
}

function chunks(terms: Hex, unit: number): Hex[] {
  const count = size(terms) / unit;
  return Array.from({ length: count }, (_, i) => slice(terms, i * unit, (i + 1) * unit));
}

/** 32 bytes: `uint128 after ‖ uint128 before`. 0 on either side means "no bound" there. */
export const decodeTimestampTerms: EnforcerDecoder = (terms) => {
  requireSize(terms, 32, "TimestampEnforcer");
  const after = hexToBigInt(slice(terms, 0, 16));
  const before = hexToBigInt(slice(terms, 16, 32));
  return {
    type: "time",
    ...(after !== 0n ? { after: Number(after) } : {}),
    ...(before !== 0n ? { before: Number(before) } : {}),
  };
};

/** N × 20-byte addresses. */
export const decodeAllowedTargetsTerms: EnforcerDecoder = (terms) => {
  requireMultipleOf(terms, 20, "AllowedTargetsEnforcer");
  return { type: "targets", addresses: chunks(terms, 20).map((a) => getAddress(a)) };
};

/** N × 4-byte function selectors. */
export const decodeAllowedMethodsTerms: EnforcerDecoder = (terms) => {
  requireMultipleOf(terms, 4, "AllowedMethodsEnforcer");
  return { type: "methods", selectors: chunks(terms, 4) };
};

/** `uint256` — max wei per single call. */
export const decodeValueLteTerms: EnforcerDecoder = (terms) => {
  requireSize(terms, 32, "ValueLteEnforcer");
  return { type: "value-per-call", maxWei: hexToBigInt(terms) };
};

/** `abi.encode(uint256)` — same 32-byte layout as ValueLte, but caps total native value across all uses. */
export const decodeNativeTokenTransferAmountTerms: EnforcerDecoder = (terms) => {
  requireSize(terms, 32, "NativeTokenTransferAmountEnforcer");
  return { type: "native-total", maxWei: hexToBigInt(terms) };
};

/** 52 bytes: `address token ‖ uint256 max`. */
export const decodeErc20TransferAmountTerms: EnforcerDecoder = (terms) => {
  requireSize(terms, 52, "ERC20TransferAmountEnforcer");
  const token = getAddress(slice(terms, 0, 20));
  const max = hexToBigInt(slice(terms, 20, 52));
  return { type: "erc20-total", token, max };
};

/** `uint256` — max number of times this delegation may be redeemed. */
export const decodeLimitedCallsTerms: EnforcerDecoder = (terms) => {
  requireSize(terms, 32, "LimitedCallsEnforcer");
  return { type: "calls", max: hexToBigInt(terms) };
};

/** N × 20-byte addresses allowed to redeem this delegation. */
export const decodeRedeemerTerms: EnforcerDecoder = (terms) => {
  requireMultipleOf(terms, 20, "RedeemerEnforcer");
  return { type: "redeemers", addresses: chunks(terms, 20).map((a) => getAddress(a)) };
};

/**
 * Keyed by the registry entry's `decoder` id (e.g. `"metamask/timestamp@1"`)
 * — never by enforcer name or address directly. A caveat only gets decoded
 * through this table when the registry has already recognized the
 * enforcer's address; an unrecognized address never reaches this map
 * (LEARNING.md §7.3: "unknown enforcer address ⇒ treat the caveat as absent").
 */
export const enforcerDecoders: Record<string, EnforcerDecoder> = {
  "metamask/timestamp@1": decodeTimestampTerms,
  "metamask/allowed-targets@1": decodeAllowedTargetsTerms,
  "metamask/allowed-methods@1": decodeAllowedMethodsTerms,
  "metamask/value-lte@1": decodeValueLteTerms,
  "metamask/native-token-transfer-amount@1": decodeNativeTokenTransferAmountTerms,
  "metamask/erc20-transfer-amount@1": decodeErc20TransferAmountTerms,
  "metamask/limited-calls@1": decodeLimitedCallsTerms,
  "metamask/redeemer@1": decodeRedeemerTerms,
};

/** Registry `decoder` ids recognized as "this enforcer composes/wraps other caveats' logic" — PL-7710-007. No terms decoder; these are flagged, not decoded. */
export const COMPOSITE_LOGIC_DECODER_IDS = new Set(["metamask/logical-or-wrapper@1"]);
