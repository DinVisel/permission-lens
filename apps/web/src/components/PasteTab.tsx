"use client";

import { useState } from "react";
import { decode } from "@permissionlens/core";
import type { DecodeResult, GrantInput } from "@permissionlens/core";
import { detectPastedSecret } from "@/lib/secrets-guard";
import { registry, REGISTRY_VERSION } from "@/lib/registry";
import { ResultView } from "./ResultView";

const PLACEHOLDER = `{
  "kind": "7702-authorization",
  "authorization": {
    "chainId": 1,
    "address": "0x...",
    "nonce": 0,
    "r": "0x...",
    "s": "0x...",
    "v": 27
  }
}`;

export function PasteTab() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secretWarning, setSecretWarning] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDecode() {
    setError(null);
    setResult(null);
    setSecretWarning(null);

    const secret = detectPastedSecret(raw);
    if (secret) {
      setSecretWarning(secret.message);
      setRaw("");
      return;
    }

    let input: GrantInput;
    try {
      input = JSON.parse(raw) as GrantInput;
    } catch {
      setError("That isn't valid JSON. Paste the request object your wallet was asked to sign.");
      return;
    }

    setPending(true);
    try {
      // Entirely client-side: no network call is made to decode. See
      // src/middleware.ts's CSP for the offline-after-first-load guarantee.
      const decoded = await decode(input, { registry, registryVersion: REGISTRY_VERSION });
      setResult(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decode this input.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="tab-intro">
        Paste the JSON your wallet was asked to sign — an EIP-7702 authorization, an ERC-7710 delegation, or an
        ERC-7715 permission request/response. Decoded entirely in your browser; nothing is sent anywhere.
      </p>
      <textarea
        rows={12}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        aria-label="Paste a signature request"
      />
      <div className="actions">
        <button onClick={handleDecode} disabled={pending || raw.trim().length === 0}>
          {pending ? "Decoding…" : "Decode"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setRaw("");
            setResult(null);
            setError(null);
            setSecretWarning(null);
          }}
        >
          Clear
        </button>
      </div>

      {secretWarning && (
        <div className="panel warning" role="alert">
          <strong>Refused.</strong> {secretWarning}
        </div>
      )}
      {error && (
        <div className="panel warning" role="alert">
          {error}
        </div>
      )}
      {result && <ResultView result={result} />}
    </div>
  );
}
