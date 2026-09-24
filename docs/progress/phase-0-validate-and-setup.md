# Phase 0 — Validate and set up

Weeks 1–2. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-0--validate-and-set-up-weeks-12).

**Status:** 🟡 in progress — everything code-side is done; the outreach/validation tasks are external and haven't been started.

## Tasks

- [ ] Post on Ethereum Magicians (Wallets / ERCs category): problem, IR sketch, rule list, request for feedback.
- [ ] Contact the Clear Signing working group (clearsigning.org).
- [ ] Message 5 potential integrators (Rabby, Ambire, Frame, Blockscout, one embedded-wallet SDK).
- [ ] Confirm the final name (`permissionlens` / `@permissionlens/*`); create the GitHub org and npm scope.
- [x] Add LICENSE-MIT, LICENSE-APACHE, CC0 for registry data, SECURITY.md, CONTRIBUTING.md.
- [x] Scaffold the monorepo: pnpm, tsup, vitest, eslint (including the network ban in `core`), changesets, CI.
  - Note: CI's `forge test` job is wired but has nothing to run yet — `contracts/` isn't scaffolded (that's Phase 1).

## Exit check

> ≥ 2 external parties want to evaluate it, **or** the Clear Signing WG confirms fit. If neither, pivot to generating ERC-7730 descriptors.

**Not yet evaluated** — depends on the outreach tasks above, which are manual/external and outside what an agent session can do on its own.

## Decisions made so far (§14)

| Decision | Status |
|---|---|
| Final name | Not yet confirmed externally — repo uses `permissionlens` / `@permissionlens/*` as a working assumption |
| License | ✅ MIT/Apache-2.0 dual for code, CC0 for registry data (the plan's recommendation) |
| Chains in registry v1 | Not yet decided — no real entries seeded yet (Phase 2) |
| 7715 revision to pin | Not yet decided — no 7715 parser exists yet (Phase 3) |
| Web app hosting | Not yet decided — no web app exists yet (Phase 4) |
| Accept `caution` entries at launch | Not yet decided |
