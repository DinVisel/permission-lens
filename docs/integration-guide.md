# Add PermissionLens to your wallet's signing screen

PermissionLens decodes what authority a signature actually grants and flags
evidence-backed risks. It doesn't sign, simulate, or connect to anything by
default — feed it the request you were about to show a confirmation screen
for, render what comes back next to your existing "Sign" button.

Both examples below decode the exact JSON-RPC request a dapp sent, unmodified
— `detect()` inside `decode()` already knows how to route
`eth_signTypedData_v4`, `eth_sendTransaction` (with an `authorizationList`),
`eth_sendRawTransaction` (type-0x04), and `wallet_grantPermissions` /
`wallet_requestExecutionPermissions`. You don't need to pre-classify the
request yourself.

```bash
npm install @permissionlens/core @permissionlens/registry
```

## Extension wallet (background script)

Intercept the request in whatever middleware sits between the provider and
your confirmation UI, before the user sees it. This example decodes and
stashes the result for the popup to read; adapt the storage call to your
wallet's own message-passing.

```ts
// background.ts
import { decode, render } from "@permissionlens/core";
import { loadDefaultRegistry } from "@permissionlens/registry";
import type { JsonRpcRequest } from "./your-provider-types";

const registry = loadDefaultRegistry(); // built once; see "Keeping the registry fresh" below

export async function beforeConfirm(request: JsonRpcRequest) {
  const result = await decode(
    { kind: "rpc", method: request.method, params: request.params },
    { registry, chainId: request.chainId },
  );

  const hasRisk = result.findings.some(
    (f) => f.severity === "critical" || f.severity === "high",
  );

  // Your existing confirmation screen reads this before rendering its
  // "Sign" button — e.g. a chrome.storage.session write, a Redux action,
  // whatever your popup already uses to get state from the background.
  await chrome.storage.session.set({
    pendingDecode: { text: render(result, { format: "text" }), hasRisk },
  });

  return hasRisk; // e.g. use this to require an extra confirm step
}
```

That's the integration — 26 lines, no UI. The popup already has a
confirmation screen; it just reads `pendingDecode` and prints `text` above
the existing sign button, and can use `hasRisk` to add friction (a second
click, a "This delegates full account control" banner) for anything severe.

## React embedded wallet

If your signing modal is a React component, decode inside it and render
findings inline. This uses the same `decode()` call — only the rendering
differs from the extension example above. `Modal`, `Finding`, `SignButton`,
`RejectButton` and `SigningModalProps` below stand in for your wallet's own
components — only `useDecodedRequest` and the `@permissionlens/*` imports
are this library's.

```tsx
// useDecodedRequest.ts
import { useEffect, useState } from "react";
import { decode, type DecodeResult, type GrantInput } from "@permissionlens/core";
import { loadDefaultRegistry } from "@permissionlens/registry";

const registry = loadDefaultRegistry();

export function useDecodedRequest(input: GrantInput | null) {
  const [result, setResult] = useState<DecodeResult | null>(null);

  useEffect(() => {
    if (!input) return setResult(null);
    let cancelled = false;
    decode(input, { registry }).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [input]);

  return result;
}
```

```tsx
// SigningModal.tsx
import { useMemo } from "react";
import { useDecodedRequest } from "./useDecodedRequest";

export function SigningModal({ request, onSign, onReject }: SigningModalProps) {
  // Memoized so the object identity is stable across renders — useDecodedRequest's
  // effect keys on it, and a fresh literal here would re-decode every render.
  const input = useMemo(
    () => ({ kind: "rpc" as const, method: request.method, params: request.params }),
    [request.method, request.params],
  );
  const decoded = useDecodedRequest(input);

  return (
    <Modal>
      {decoded?.findings.map((f) => (
        <Finding key={f.ruleId} severity={f.severity} title={f.title} detail={f.detail} />
      ))}
      <SignButton onClick={onSign} confirmExtra={decoded?.findings.some((f) => f.severity === "critical")} />
      <RejectButton onClick={onReject} />
    </Modal>
  );
}
```

The hook is 23 lines; wiring it into the modal is another 23. `apps/web`'s
[`ResultView`](../apps/web/src/components/ResultView.tsx) is a fuller
reference for rendering `findings`, `notChecked` and `grants` if you want
more than a flat list.

## What to show, and what not to claim

- Findings have a `severity` (`critical` | `high` | `medium` | `low` | `info`)
  and a `confidence` (`certain` | `heuristic`) — surface both; a heuristic
  match on a sweeper pattern is not the same certainty as a registry hit.
- Every finding's `docsUrl` names a rule ID you can link to your own copy of
  [`docs/rules/`](rules) (or `apps/web`'s `/rules/<id>` if you're already
  pointing users at the hosted site).
- Never render a clean result (`findings.length === 0`) as "safe" or
  "secure" — render what `render(result, { format: "text" })` already says:
  "No issues found by N checks (M not run)." `result.notChecked` lists what
  didn't run and why (usually missing on-chain facts — see
  `@permissionlens/onchain`'s `enrich()` to fill those in for a
  `eth_sendTransaction`/`eth_sendRawTransaction` decode, at the cost of a
  network round trip).

## Keeping the registry fresh

`loadDefaultRegistry()` bundles whatever `@permissionlens/registry` shipped
with — fine for prototyping, but it goes stale as new delegate
implementations and enforcers get reviewed in. For production, either bump
`@permissionlens/registry` on your own release cadence, or fetch
[`packages/registry/data/*.json`](../packages/registry/data) at runtime and
pass entries to `loadBundledRegistry()` yourself.
