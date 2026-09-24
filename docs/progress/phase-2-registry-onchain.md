# Phase 2 — Registry v0 and on-chain enrichment

Weeks 6–8. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-2--registry-v0-and-on-chain-enrichment-weeks-68).

**Status:** 🟡 in progress — enrichment, the new rules, and the CLI acceptance criterion are done and tested against a real anvil node; what's left is `tools/census` and seeding real registry data, both of which need external data/verification this session couldn't safely do on its own.

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
- [ ] `tools/census` v0: enumerate delegations for a block range, cluster, write CSV output.
  → Only a planning README exists. Needs either RPC access to a real chain's history or a Dune export — out of scope for an offline/sandboxed session.
- [ ] Seed ≥ 10 recognized entries from vendor sources; review top census clusters for malicious entries.
  → The 3 entries in `packages/registry/data/` are explicitly-labeled placeholders (fake addresses, `submittedBy: "placeholder"`), not real vendor data. **Do not treat them as real registry entries.** Seeding real ones means copying addresses from each vendor's own official repo/docs (§7.4) — that's a research task for a human (or an agent with verified web access to those specific sources), not something to fabricate from memory.
- [x] CI job verifying codehashes of registry entries against public RPCs (nightly, non-blocking).
  → [`.github/workflows/registry-codehash-nightly.yml`](../../.github/workflows/registry-codehash-nightly.yml) + [`verify-codehashes.mjs`](../../packages/registry/scripts/verify-codehashes.mjs). Nothing to actually verify yet, since there's no real registry data — starts being useful the moment real entries land.

## Acceptance criteria

- [x] `permissionlens address <addr> --rpc <url>` reports "delegated to X (recognized/unknown/malicious), how to revoke."
  → [`packages/cli/src/cli.ts`](../../packages/cli/src/cli.ts)'s `address` command. Smoke-tested end to end against a live anvil node (deployed SweeperDelegate, delegated a test EOA to it via `anvil_setCode`, confirmed the CLI reports PL-7702-011/003 and exits 2; confirmed a non-delegated address reports unsupported and exits 0).
- [x] An anvil test: delegate an EOA to the sweeper fixture and PL-7702-011 fires; to the benign fixture and it doesn't.
  → Two independent versions of this: `enrich()` against a decoded authorization pointing at deployed fixtures (doesn't need a live 7702 delegation — enrich() only reads the delegate's own bytecode), and `checkAddressDelegation()` against an EOA whose code is set directly to the real `0xef0100 ‖ delegate` indicator via anvil's `anvil_setCode` cheat. Neither submits a live type-0x04 transaction; see the top-of-file comment in `enrich.test.ts` for why that's a deliberate, faithful simplification rather than a shortcut.

## What's left before calling Phase 2 done

1. `tools/census` v0 (needs real chain history access).
2. Seeding ≥ 10 real `recognized` entries and reviewing real malicious clusters (needs vendor-source research + governance review, not something to do unattended).
3. PL-7702-008 (Sourcify verification) and PL-7702-012 (cross-chain code diff, needs multiple RPC endpoints per grant).
