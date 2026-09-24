# Phase 1 — 7702 core

Weeks 3–5. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-1--7702-core-weeks-35) and the [first 15 issues](../../IMPLEMENTATION_PLAN.md#15-first-15-issues).

**Status:** 🟢 done.

## Tasks

- [x] `parseAuthorization`: normalize `address`/`contractAddress`, recover the authority, validate low-s and `yParity`.
  → [`authorization.ts`](../../packages/core/src/authorization.ts)
- [x] `parse7702Transaction`: `parseTransaction` → one grant per tuple, sender as context.
  → [`transaction.ts`](../../packages/core/src/transaction.ts)
- [x] Grant IR, `Finding`, rule runner with `requiredFacts`, `notChecked`.
  → [`types.ts`](../../packages/core/src/types.ts), [`rules/runner.ts`](../../packages/core/src/rules/runner.ts)
- [x] Rules PL-7702-001/003/004/005/013/014.
  → [`rules/7702.ts`](../../packages/core/src/rules/7702.ts)
- [x] Rule PL-GEN-001 (raw hash).
  → [`rules/generic.ts`](../../packages/core/src/rules/generic.ts)
- [x] Rule PL-GEN-003 (explicit "unsupported" result) — emitted directly by `decode()` (not through the rule runner, since it isn't tied to a `Grant`) alongside `DecodeResult.unsupported`.
- [x] Minimal registry loader with a hand-written stub dataset.
  → [`packages/registry`](../../packages/registry) (3 example entries — not real vendor data, see Phase 2)
- [x] `render()` for text and JSON; the "never say safe" test.
  → [`render.ts`](../../packages/core/src/render.ts)
- [x] CLI: `permissionlens decode <file|json>`.
  → [`packages/cli`](../../packages/cli)
- [x] Foundry fixtures: generate signed delegations with `vm.signDelegation` (including cross-chain) and export them as JSON fixtures.
  → [`contracts/`](../../contracts): `BenignDelegate.sol`, `SweeperDelegate.sol`, `ProxyDelegate.sol` + `FixtureImplementation.sol`, all with their own `forge test` sanity checks. `script/GenerateFixtures.s.sol` signs authorizations to each with `vm.signDelegation` (one cross-chain, `chainId = 0`) using Anvil's well-known test key — the same key `packages/core`'s own tests use, so recovered `grantor` addresses match across the Solidity and TS sides.

## Acceptance criteria

- [x] Digest and recovery match viem for property-generated tuples, including `nonce = 0` and `chainId = 0`.
  → [`authorization.test.ts`](../../packages/core/src/authorization.test.ts): 1000-run property test + explicit zero-case test + the Lab 6 regression test.
- [x] Golden tests cover every rule, positive and negative.
  → [`decode.test.ts`](../../packages/core/src/decode.test.ts) unit-tests each rule individually (positive and negative), and [`golden.test.ts`](../../packages/core/test/golden.test.ts) re-runs `decode()` against the 3 Foundry-generated fixtures in [`fixtures/7702/`](../../fixtures/7702) and diffs against a committed `expected.json` snapshot — CI's `fixtures-drift` job regenerates them from scratch and fails on any diff, so the snapshots can't silently go stale.
- [x] The core bundle has no network imports (CI check).
  → `eslint.config.js` `no-restricted-imports` rule scoped to `packages/core/src`, plus a CI grep step over `dist/`. The golden test itself lives in `packages/core/test/` (outside that glob) specifically so it can use `node:fs` to read fixture files without weakening the rule for the actual package source.

## Notes for future phases

- `expected.json` is a snapshot of `decode()`'s own output, not independently hand-verified line-by-line — see the caveat in `contracts/README.md`. It catches regressions, not incorrect-from-day-one behavior; the individual rule tests in `decode.test.ts` are what establish correctness.
- The 3 fixture delegates (`BenignDelegate`, `SweeperDelegate`, `ProxyDelegate`) are deliberately obvious/minimal, built for testing the decoder — not a starting point for the sweeper heuristic itself (Phase 2, PL-7702-011) or for the registry's malicious-cluster data (real sweepers come from `tools/census`, not from a fixture contract).
