# Phase 2 — Registry v0 and on-chain enrichment

Weeks 6–8. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-2--registry-v0-and-on-chain-enrichment-weeks-68).

**Status:** 🟡 in progress — enrichment, the new rules, the CLI acceptance criterion, and `tools/census` v0 are done and tested against a real anvil node; what's left is running census against real chain history and getting a second maintainer review on the seeded registry entries.

## Tasks

- [x] Registry JSON Schema, loader, and matching order (§7.2). *(landed early, in Phase 1)*
  → [`packages/registry`](../../packages/registry)
- [x] `codehash` and `normalizedCodehash`: strip the CBOR metadata trailer, mask PUSH20 operands.
  → [`codehash.ts`](../../packages/core/src/bytecode/codehash.ts), unit-tested against hand-crafted bytecode covering PUSH-immediate desync and CBOR-trailer edge cases.
- [x] `@permissionlens/onchain` `enrich()`: `getCode`, EIP-1967/1167 proxy detection, `getTransactionCount`.
  → [`enrich-grant.ts`](../../packages/onchain/src/enrich-grant.ts). **Not done:** Sourcify verification lookup (needs a third-party network call not yet integrated) and the delegation-indicator check itself lives separately in `checkAddressDelegation()`, not `enrich()` (enrich() enriches grants that already exist; checking whether an address is delegated is a different question, see below).
- [x] Rules PL-7702-002 (also reachable offline by address)/006/007/009/010/011/015.
  → [`rules/7702.ts`](../../packages/core/src/rules/7702.ts). **Not done:** PL-7702-008 (Sourcify) and PL-7702-012 (cross-chain code diff, needs multi-RPC) — both explicitly out of scope for this pass, flagged in `enrich()`'s own doc comment.
- [x] Sweeper heuristic plus fixtures, with anvil integration tests.
  → [`sweeper-heuristic.ts`](../../packages/core/src/bytecode/sweeper-heuristic.ts) (unit-tested against real compiled fixture bytecode) plus [`packages/onchain/test/enrich.test.ts`](../../packages/onchain/test/enrich.test.ts) and [`check-address.test.ts`](../../packages/onchain/test/check-address.test.ts) (real anvil node: deploys the fixtures, confirms PL-7702-011 fires for the sweeper and not for the benign delegate).
- [x] `tools/census` v0: enumerate delegations for a block range, cluster, write CSV output.
  → [`tools/census`](../../tools/census): scans a block range over RPC (or ingests a pre-collected CSV, e.g. a Dune export) for type-0x04 transactions, clusters delegates by `normalizedCodehash` using `@permissionlens/core`'s existing codehash functions, annotates each cluster against the bundled registry, and writes a ranked CSV. Tested end-to-end against a real `anvil --hardfork prague` node in [`tools/census/test/census.test.ts`](../../tools/census/test/census.test.ts) — unlike `enrich.test.ts`/`check-address.test.ts`, this one submits real type-0x04 transactions, since that's specifically what census scans for. **Not done:** actually running it against real chain history to produce the public census dataset — that needs someone to pick an RPC provider and a meaningful block range, which is a choice for a human, not something to do unattended.
- [ ] Seed ≥ 10 recognized entries from vendor sources; review top census clusters for malicious entries.
  → 11 real `recognized` entries are in `packages/registry/data/` (MetaMask Delegation Toolkit v1.3.0, fetched by a prior session directly from `MetaMask/delegation-toolkit@main`), past the ≥10 target — but each is explicitly flagged `"NEEDS HUMAN REVIEW"` in its `review.reviewers` field: GOVERNANCE.md requires 2 maintainer approvals for `recognized` status, and only one automated pass has happened. A human needs to actually verify these against the vendor source and approve, or this box shouldn't be checked. Reviewing real census clusters for `malicious` entries additionally needs `tools/census` run against real chain history first (see above).
- [x] CI job verifying codehashes of registry entries against public RPCs (nightly, non-blocking).
  → [`.github/workflows/registry-codehash-nightly.yml`](../../.github/workflows/registry-codehash-nightly.yml) + [`verify-codehashes.mjs`](../../packages/registry/scripts/verify-codehashes.mjs). Nothing to actually verify yet, since there's no real registry data — starts being useful the moment real entries land.

## Acceptance criteria

- [x] `permissionlens address <addr> --rpc <url>` reports "delegated to X (recognized/unknown/malicious), how to revoke."
  → [`packages/cli/src/cli.ts`](../../packages/cli/src/cli.ts)'s `address` command. Smoke-tested end to end against a live anvil node (deployed SweeperDelegate, delegated a test EOA to it via `anvil_setCode`, confirmed the CLI reports PL-7702-011/003 and exits 2; confirmed a non-delegated address reports unsupported and exits 0).
- [x] An anvil test: delegate an EOA to the sweeper fixture and PL-7702-011 fires; to the benign fixture and it doesn't.
  → Two independent versions of this: `enrich()` against a decoded authorization pointing at deployed fixtures (doesn't need a live 7702 delegation — enrich() only reads the delegate's own bytecode), and `checkAddressDelegation()` against an EOA whose code is set directly to the real `0xef0100 ‖ delegate` indicator via anvil's `anvil_setCode` cheat. Neither submits a live type-0x04 transaction; see the top-of-file comment in `enrich.test.ts` for why that's a deliberate, faithful simplification rather than a shortcut.

## What's left before calling Phase 2 done

1. Running `tools/census` against real chain history (needs an RPC provider and a chosen block range — a human decision).
2. A second maintainer review confirming the 11 seeded `recognized` entries, and reviewing real census clusters for `malicious` candidates once (1) has run.
3. PL-7702-008 (Sourcify verification) and PL-7702-012 (cross-chain code diff, needs multiple RPC endpoints per grant).
