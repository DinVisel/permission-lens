# @permissionlens/snap

PermissionLens as a [MetaMask Snap](https://docs.metamask.io/snaps/): the
same offline decode/rules from `@permissionlens/core`, surfaced as signature
and transaction insights in MetaMask's own confirmation UI.

## What it actually covers

- **Signature insight** (`onSignature`): decodes `eth_signTypedData_v3` and
  `eth_signTypedData_v4` payloads shaped like an ERC-7710 delegation, and
  shows PermissionLens's findings inline. `personal_sign` and
  `eth_signTypedData` (v1) are never grant formats, so those — and any v3/v4
  payload that isn't delegation-shaped (an NFT listing, a Permit2 approval,
  ...) — produce no insight at all, deliberately: an insight on every
  unrelated dapp signature would be noise, not a warning.
- **Transaction insight** (`onTransaction`): checks for an `authorizationList`
  on the transaction and decodes it as an EIP-7702 authorization if present.

  **Known limit, stated honestly (see `IMPLEMENTATION_PLAN.md` §9's own
  instruction to "document the limits honestly"):** as of
  `@metamask/snaps-sdk` 12.0.1, the `Transaction` type `onTransaction`
  receives has no `authorizationList` field — MetaMask's transaction-insight
  API doesn't currently expose it. The check in `src/index.ts` is there in
  case that changes, but today it means `onTransaction` returns no insight
  for effectively every transaction, EIP-7702 ones included. This Snap's real
  7702/7710 coverage is the signature-insight handler above, not this one.
- **Home page** (`onHomePage`): a static explainer of the above, so a user
  who opens the Snap's page from MetaMask's settings sees the same scope
  note rather than an empty screen.

ERC-7715 permission requests (`wallet_grantPermissions`) aren't reachable at
all from either handler — Snaps insights only hook `onTransaction` and
`onSignature`, and 7715 requests go through a different RPC method neither
one sees. There's no workaround for that from within a Snap today.

## Local development

```bash
pnpm install
pnpm build   # from apps/snap/, or `pnpm --filter @permissionlens/snap build`
pnpm test
```

`pnpm build` runs `mm-snap build`, which bundles `src/index.ts`, evaluates
the bundle in SES for compatibility, and fixes up `snap.manifest.json`
(shasum, `platformVersion`) in place. To try it in a wallet, `pnpm dev`
(`mm-snap watch`) serves it locally; install it in
[MetaMask Flask](https://metamask.io/flask/) by connecting a dapp to
`local:http://localhost:8080` (the [Snaps Simple Keyring
site](https://metamask.github.io/snap-simple-keyring/latest/) or your own
test dapp both work for this).

### Known issue: SES eval on a non-ASCII checkout path

`snap.config.ts` skips the SES-eval build step automatically when
`process.cwd()` contains non-ASCII characters. That's worked around here
because this repository's own path (under a directory named
`Masaüstü`) triggers a bug in `@metamask/snaps-utils`' eval-worker
spawning: it builds a `file://` URL from the cwd and resolves it back to a
path without decoding the percent-escapes it just added, so on a path with
non-ASCII characters the eval worker looks for a path that never existed and
fails to launch — unrelated to whether the Snap bundle itself is SES-safe. A
checkout on an ASCII path (any real CI included) still gets the real check;
nothing here silently skips it in general. Deleting or renaming outside that
condition would be a red flag reviewing this diff — check `git log` if this
note and the config's behavior ever seem to disagree.

## Review checklist status

Locally verified, with `mm-snap build` producing a clean, warning-free build:

- [x] `mm-snap build` succeeds with an auto-fixed, schema-valid
      `snap.manifest.json` (shasum, `platformVersion`, `repository` all
      consistent with the built bundle and `package.json`).
- [x] `@metamask/snaps-sdk` pinned to `12.0.1` — the version
      `mm-snap build` itself flags as MetaMask production's current maximum
      supported platform version (`^12.1.0` built and ran, but warned it
      isn't yet supported by the shipping extension).
- [x] SVG icon at `images/icon.svg`, referenced from the manifest.
- [x] `initialPermissions` requests only what's used:
      `endowment:signature-insight`, `endowment:transaction-insight`,
      `endowment:page-home` — no `endowment:network-access` (this Snap makes
      no network calls; it's exactly as offline as `@permissionlens/core`),
      no `endowment:cronjob`, no account/keyring permissions.
- [x] Never claims a decoded grant is "safe" — `render-insight.ts` mirrors
      `@permissionlens/core`'s own render() wording (`packages/core/src/render.ts`):
      a clean result says "no issues found by N checks", never "safe".
- [x] Unit tests (`src/index.test.ts`) exercise all three handlers, including
      that a non-grant signature produces no insight (not a false one).

Not yet done, because they need a real MetaMask Flask install rather than
anything this session can verify on its own: a manual install-and-sign
walkthrough in Flask, and MetaMask's own submission review once this is
published.
