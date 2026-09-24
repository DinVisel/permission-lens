import { describe, expect, it } from "vitest";
import { NodeType } from "@metamask/snaps-sdk";
import type { Component } from "@metamask/snaps-sdk";
import { ROOT_AUTHORITY } from "@permissionlens/core";
import { onHomePage, onSignature, onTransaction } from "./index.js";

const DELEGATION_MANAGER = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";
const DELEGATE = `0x${"5e55104".padStart(40, "0")}`;
const DELEGATOR = `0x${"5e1e94".padStart(40, "0")}`;

const NO_CAVEATS_DELEGATION_TYPED_DATA = {
  domain: { name: "DelegationManager", version: "1", chainId: 1, verifyingContract: DELEGATION_MANAGER },
  primaryType: "Delegation",
  message: {
    delegate: DELEGATE,
    delegator: DELEGATOR,
    authority: ROOT_AUTHORITY,
    caveats: [],
    salt: "0",
  },
};

/** Every response in these tests uses the `content` variant, never `id` — narrows past the union so callers don't need a cast at each call site. All our handlers build plain Component panels, never JSX, so the cast back to Component is safe here. */
function getContent(response: { content: unknown } | { id: string }): Component {
  if (!("content" in response)) throw new Error("expected a content response, got an interface id");
  return response.content as Component;
}

/** Flattens a Component panel to its Text/Row values, for readable assertions instead of a full snapshot of the node tree. */
function flattenText(component: Component): string[] {
  if (component.type === NodeType.Panel) {
    return component.children.flatMap(flattenText);
  }
  if (component.type === NodeType.Text || component.type === NodeType.Heading) {
    return [component.value];
  }
  if (component.type === NodeType.Row) {
    const value = component.value.type === NodeType.Text ? component.value.value : "";
    return [component.label, value];
  }
  return [];
}

describe("onSignature", () => {
  it("decodes a no-caveats ERC-7710 delegation (eth_signTypedData_v4) and flags PL-7710-001", async () => {
    const response = await onSignature({
      signature: { from: DELEGATOR, data: NO_CAVEATS_DELEGATION_TYPED_DATA, signatureMethod: "eth_signTypedData_v4" },
      signatureOrigin: "https://example.dapp",
    });

    expect(response).not.toBeNull();
    expect(response?.severity).toBe("critical");
    const lines = flattenText(getContent(response!));
    expect(lines).toContain("PL-7710-001");
  });

  it("returns null for personal_sign — never a grant format", async () => {
    const response = await onSignature({
      signature: { from: DELEGATOR, data: "0xdeadbeef", signatureMethod: "personal_sign" },
    });
    expect(response).toBeNull();
  });

  it("returns null for typed data that isn't a delegation (no noisy insight on unrelated dapp signatures)", async () => {
    const response = await onSignature({
      signature: {
        from: DELEGATOR,
        data: { domain: { name: "SomeNftMarketplace", version: "1" }, primaryType: "Order", message: {} },
        signatureMethod: "eth_signTypedData_v4",
      },
    });
    expect(response).toBeNull();
  });
});

describe("onTransaction", () => {
  it("returns null when the transaction has no authorizationList (the common case — see index.ts's doc comment)", async () => {
    const response = await onTransaction({
      transaction: { from: DELEGATOR, to: DELEGATE, nonce: "0x0", value: "0x0", data: "0x", gas: "0x5208", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1", estimateSuggested: "0x1", estimateUsed: "0x1" },
      chainId: "eip155:1",
    });
    expect(response).toBeNull();
  });

  it("decodes authorizationList when present, defensively (see index.ts's doc comment on why this may never fire in production)", async () => {
    const response = await onTransaction({
      transaction: {
        from: DELEGATOR,
        to: DELEGATOR,
        nonce: "0x0",
        value: "0x0",
        data: "0x",
        gas: "0x5208",
        maxFeePerGas: "0x1",
        maxPriorityFeePerGas: "0x1",
        estimateSuggested: "0x1",
        estimateUsed: "0x1",
        // @ts-expect-error -- authorizationList isn't in the SDK's Transaction type; see index.ts's doc comment
        authorizationList: [{ chainId: 0, address: DELEGATE, nonce: 0, r: `0x${"1".repeat(64)}`, s: `0x${"2".repeat(64)}`, v: 27 }],
      },
      chainId: "eip155:1",
    });

    expect(response).not.toBeNull();
    const lines = flattenText(getContent(response!));
    expect(lines.join(" ")).toContain("PL-7702-001");
  });
});

describe("onHomePage", () => {
  it("returns a static explainer panel", async () => {
    const response = await onHomePage();
    const lines = flattenText(getContent(response));
    expect(lines.join(" ")).toContain("PermissionLens");
  });
});
