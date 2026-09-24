# Phase 1 — 7702 core

Weeks 3–5. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-1--7702-core-weeks-35) and the [first 15 issues](../../IMPLEMENTATION_PLAN.md#15-first-15-issues).

**Status:** 🟡 in progress — the decode/rules/CLI path is done and tested; Foundry-generated fixtures are the main gap.

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
- [ ] Rule PL-GEN-003 (explicit "unsupported" result) — handled today as `DecodeResult.unsupported`, not as a standalone `Finding`-emitting rule. Revisit whether the plan wants both.
- [x] Minimal registry loader with a hand-written stub dataset.
  → [`packages/registry`](../../packages/registry) (3 example entries — not real vendor data, see Phase 2)
- [x] `render()` for text and JSON; the "never say safe" test.
  → [`render.ts`](../../packages/core/src/render.ts)
- [x] CLI: `permissionlens decode <file|json>`.
  → [`packages/cli`](../../packages/cli)
- [ ] Foundry fixtures: generate signed delegations with `vm.signDelegation` (including cross-chain) and export them as JSON fixtures.
  → `contracts/` has only a planning README so far; no `forge init` yet.

## Acceptance criteria

- [x] Digest and recovery match viem for property-generated tuples, including `nonce = 0` and `chainId = 0`.
  → [`authorization.test.ts`](../../packages/core/src/authorization.test.ts): 1000-run property test + explicit zero-case test + the Lab 6 regression test.
- [ ] Golden tests cover every rule, positive and negative.
  → Partial: [`decode.test.ts`](../../packages/core/src/decode.test.ts) covers each rule at least once, but there's no `fixtures/<case>/{input,expected}.json` golden-file setup yet (that's what `fixtures/README.md` describes as planned).
- [x] The core bundle has no network imports (CI check).
  → `eslint.config.js` `no-restricted-imports` rule scoped to `packages/core/src`, plus a CI grep step over `dist/`.

## What's left before calling Phase 1 done

1. Scaffold `contracts/` with Foundry (`forge init`), a benign delegate, a sweeper-pattern delegate, an EIP-1967 proxy delegate.
2. A fixture generator script using `vm.signDelegation` → `fixtures/*.json`.
3. Convert the inline decode.test.ts cases into the golden `fixtures/<case>/{input,expected}.json` format so CLI and web app can share them later.
4. Decide on PL-GEN-003's shape (see note above).
