"use client";

import { useState } from "react";
import { createPublicClient, http, isAddress } from "viem";
import type { Address } from "viem";
import type { DecodeResult } from "@permissionlens/core";
import { checkAddressDelegation } from "@permissionlens/onchain";
import { registry, REGISTRY_VERSION } from "@/lib/registry";
import { ResultView } from "./ResultView";

export function CheckAddressTab() {
  const [address, setAddress] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [chainId, setChainId] = useState("");
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = isAddress(address) && rpcUrl.trim().length > 0 && !pending;

  async function handleCheck() {
    setError(null);
    setResult(null);

    if (!isAddress(address)) {
      setError("Not a valid address.");
      return;
    }

    setPending(true);
    try {
      // Unlike the "Paste a request" tab, this necessarily talks to the RPC
      // URL you provide — reading what an address is *currently* delegated
      // to means a network call. The URL and address you enter go only to
      // that RPC endpoint, never to us.
      const client = createPublicClient({ transport: http(rpcUrl.trim()) });
      const parsedChainId = chainId.trim() ? Number.parseInt(chainId, 10) : undefined;
      const decoded = await checkAddressDelegation(address as Address, {
        client,
        chainId: parsedChainId,
        registry,
        registryVersion: REGISTRY_VERSION,
      });
      setResult(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check this address.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="tab-intro">
        Check what an address is currently delegated to on-chain (EIP-7702). This calls the RPC URL you provide —
        unlike the paste tab, it isn&apos;t offline.
      </p>
      <div className="field-grid">
        <label>
          Address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" spellCheck={false} />
        </label>
        <label>
          RPC URL
          <input
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            placeholder="https://…"
            spellCheck={false}
          />
        </label>
        <label>
          Chain ID <span className="optional">(optional — read from the RPC if omitted)</span>
          <input value={chainId} onChange={(e) => setChainId(e.target.value)} placeholder="1" spellCheck={false} />
        </label>
      </div>
      <div className="actions">
        <button onClick={handleCheck} disabled={!canSubmit}>
          {pending ? "Checking…" : "Check"}
        </button>
      </div>

      {error && (
        <div className="panel warning" role="alert">
          {error}
        </div>
      )}
      {result && <ResultView result={result} />}
    </div>
  );
}
