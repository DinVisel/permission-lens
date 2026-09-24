import { applyRegistryFacts, computeCodehash, computeNormalizedCodehash } from "@permissionlens/core";
import type { Grant, RegistryLookup } from "@permissionlens/core";
import type { Address, Hex, PublicClient } from "viem";

export interface EnrichGrantOptions {
  client: PublicClient;
  chainId?: number;
  registry?: RegistryLookup;
}

/** `bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)` — the standard EIP-1967 implementation slot. */
const EIP1967_IMPLEMENTATION_SLOT: Hex = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/** EIP-1167 minimal proxy runtime bytecode has a fixed shape with the implementation address embedded in the middle. */
const EIP1167_PREFIX = "363d3d373d3d3d363d73";
const EIP1167_SUFFIX = "5af43d82803e903d91602b57fd5bf3";

/**
 * Fetches on-chain facts for a single grant (delegate code, codehash, proxy
 * detection, the authority's current nonce) and re-resolves registry facts
 * now that a codehash is known. Shared by `enrich()` (re-enriching grants
 * that came from `decode()`) and `checkAddressDelegation()` (enriching a
 * grant built from a live on-chain observation, with no `decode()` step at
 * all) — the enrichment logic itself doesn't care which one it was.
 */
export async function enrichGrant(grant: Grant, options: EnrichGrantOptions): Promise<Grant> {
  const facts: Record<string, unknown> = { ...grant.facts };

  if (grant.grantee.type === "code") {
    const address = grant.grantee.address;
    const code = (await options.client.getCode({ address })) ?? "0x";
    facts.codeAt = code;

    if (code !== "0x") {
      facts.codehash = computeCodehash(code);
      facts.normalizedCodehash = computeNormalizedCodehash(code);

      const minimalProxyImplementation = detectEip1167(code);
      if (minimalProxyImplementation) {
        facts.isProxy = true;
        facts.proxyImplementation = minimalProxyImplementation;
      } else {
        const implementation = await detectEip1967(options.client, address);
        facts.isProxy = implementation !== null;
        if (implementation) facts.proxyImplementation = implementation;
      }
    }
  }

  if (grant.grantor) {
    facts.currentNonce = BigInt(await options.client.getTransactionCount({ address: grant.grantor }));
  }

  const enriched: Grant = { ...grant, facts };
  applyRegistryFacts(enriched, { registry: options.registry, chainId: options.chainId });
  return enriched;
}

function detectEip1167(code: Hex): Address | null {
  const hex = code.slice(2).toLowerCase();
  if (!hex.startsWith(EIP1167_PREFIX) || !hex.endsWith(EIP1167_SUFFIX)) return null;
  const implementation = hex.slice(EIP1167_PREFIX.length, EIP1167_PREFIX.length + 40);
  if (implementation.length !== 40) return null;
  return `0x${implementation}` as Address;
}

/**
 * EIP-1967 has no bytecode signature — it's identified purely by
 * convention (a specific storage slot). Reads that slot and treats a
 * non-zero, address-shaped value as a match; a real non-proxy contract
 * essentially never coincidentally holds data at this pseudo-random slot.
 */
async function detectEip1967(client: PublicClient, address: Address): Promise<Address | null> {
  const slotValue = await client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT });
  if (!slotValue || slotValue === `0x${"0".repeat(64)}`) return null;
  const hex = slotValue.slice(2);
  if (hex.slice(0, 24) !== "0".repeat(24)) return null; // upper 12 bytes must be zero for this to be an address
  return `0x${hex.slice(24)}` as Address;
}
