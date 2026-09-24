import type { Address } from "viem";

/**
 * Contract that any registry lookup must satisfy. `packages/core` declares
 * this interface but never imports `@permissionlens/registry` itself — the
 * caller (CLI, web app, ...) wires bundled or fetched registry data in via
 * DecodeOptions, keeping core network-free and registry-agnostic
 * (IMPLEMENTATION_PLAN.md §4.3: "core deps: viem only").
 */
export interface RegistryEntry {
  name: string;
  vendor?: string;
  version?: string;
  status: "recognized" | "caution" | "malicious";
  properties?: {
    upgradeable?: boolean;
    initialization?: "none" | "signed" | "unprotected";
    storage?: "erc7201" | "plain" | "none";
  };
  evidence?: { type: string; url: string }[];
}

export interface RegistryLookup {
  lookupAddress(address: Address, chainId?: number): RegistryEntry | null;
}
