# Phase 4 — Surfaces

Weeks 13–16. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-4--surfaces-weeks-1316).

**Status:** 🟡 in progress — web app, docs site and integration guide done; Snap remains.

## Tasks

- [x] Web app (Next.js): "Paste a request" and "Check an address" tabs; shared renderer; client-side decoding.
  - [x] Refuse pasted private keys and seed phrases (64-hex strings, 12/24-word BIP-39 phrases) with a clear warning.
  - [x] Strict CSP; no analytics on pasted content.
- [ ] MetaMask Snap: signature insights (7710 delegations, delegate execution intents) and transaction insights.
- [x] Integration guide: "Add PermissionLens to your wallet's signing screen in 30 lines."
  - Done as [`docs/integration-guide.md`](../integration-guide.md): an extension-wallet example (background script, 26 lines) and a React embedded-wallet example (a `useDecodedRequest` hook plus wiring it into a signing modal, 23 lines each). Both snippets are typechecked against the real package API, not illustrative pseudocode.
- [x] Docs site: one page per rule ID.
  - Note: `docs/rules/*.md` pages already exist per rule ID from Phase 1 — this task is about publishing them as a site, not writing them from scratch.
  - Done as `apps/web`'s `/rules` (index) and `/rules/[id]` routes, reading `docs/rules/*.md` directly — no separate docs-site package.

## Acceptance criteria

- [x] The web app works offline after first load for paste-decoding.
- [ ] The Snap passes the MetaMask Snaps review checklist locally.

## Dependencies

Needs Phase 2 (on-chain enrichment) and ideally Phase 3 (7710/7715) so the
web app and Snap have something more than 7702 to show.
