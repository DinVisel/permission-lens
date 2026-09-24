import { decode, type GrantInput } from "@permissionlens/core";
import { SeverityLevel } from "@metamask/snaps-sdk";
import type { OnHomePageHandler, OnSignatureHandler, OnTransactionHandler } from "@metamask/snaps-sdk";
import { registry, REGISTRY_VERSION } from "./registry";
import { renderInsight, statusPanel } from "./render-insight";

/**
 * `eth_signTypedData` (v1, `data` is an array) and `personal_sign` never
 * carry a grant — only v3/v4 typed data can be an ERC-7710 delegation.
 * Handled here rather than left to `decode()` so those (by far the most
 * common) signatures don't produce a noisy "not decoded" insight on every
 * unrelated dapp signature.
 */
const DECODABLE_SIGNATURE_METHODS = new Set(["eth_signTypedData_v3", "eth_signTypedData_v4"]);

export const onSignature: OnSignatureHandler = async ({ signature }) => {
  if (!DECODABLE_SIGNATURE_METHODS.has(signature.signatureMethod)) {
    return null;
  }

  const result = await decode(
    { kind: "typed-data", typedData: signature.data },
    { registry, registryVersion: REGISTRY_VERSION },
  );

  // Not delegation-shaped typed data (an NFT listing, a permit, ...) — say
  // nothing rather than flag every EIP-712 signature this Snap can't speak to.
  if (result.unsupported) {
    return null;
  }

  return {
    content: renderInsight(result),
    severity: hasCritical(result) ? SeverityLevel.Critical : undefined,
  };
};

/**
 * `@metamask/snaps-sdk`'s `Transaction` type (as of 12.1.0) is an
 * EIP-1559/legacy shape only — it has no `authorizationList` field, so an
 * EIP-7702 transaction's authorization list isn't something `onTransaction`
 * is documented to expose. This checks for it defensively at runtime in
 * case MetaMask starts passing it through, but honestly: today, this
 * handler will return `null` (no insight) for essentially every
 * transaction, including 7702 ones. Signature insight (above) is where
 * this Snap's 7710/7715 coverage actually lives; transaction insight for
 * 7702 needs an upstream Snaps API change to become possible at all.
 */
export const onTransaction: OnTransactionHandler = async ({ transaction, chainId }) => {
  const authorizationList = (transaction as Record<string, unknown>).authorizationList;
  if (!Array.isArray(authorizationList) || authorizationList.length === 0) {
    return null;
  }

  const input: GrantInput = { kind: "rpc", method: "eth_sendTransaction", params: [{ authorizationList }] };
  const result = await decode(input, {
    registry,
    chainId: caipToEvmChainId(chainId),
    registryVersion: REGISTRY_VERSION,
  });

  return {
    content: renderInsight(result),
    severity: hasCritical(result) ? SeverityLevel.Critical : undefined,
  };
};

export const onHomePage: OnHomePageHandler = async () => {
  return { content: statusPanel() };
};

function hasCritical(result: { findings: { severity: string }[] }): boolean {
  return result.findings.some((f) => f.severity === "critical");
}

/** "eip155:1" -> 1. Returns undefined for non-eip155 namespaces (nothing this Snap decodes runs there) or a malformed CAIP-2 id. */
function caipToEvmChainId(caipChainId: string): number | undefined {
  const [namespace, reference] = caipChainId.split(":");
  if (namespace !== "eip155" || !reference) return undefined;
  const chainId = Number.parseInt(reference, 10);
  return Number.isNaN(chainId) ? undefined : chainId;
}
