# Phase 2 — Registry v0 and on-chain enrichment

Weeks 6–8. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-2--registry-v0-and-on-chain-enrichment-weeks-68).

**Status:** ⚪ not started — the registry *package* (schema/loader) was built ahead of schedule during Phase 1, but everything specific to this phase (real data, codehash tooling, enrichment, chain-dependent rules) is still open.

## Tasks

- [x] Registry JSON Schema, loader, and matching order (§7.2). *(landed early, in the Phase 1 work)*
  → [`packages/registry`](../../packages/registry)
- [ ] `codehash` and `normalizedCodehash`: strip the CBOR metadata trailer, mask PUSH20 operands.
  → Not implemented. The schema/loader accept these fields but nothing computes them from bytecode yet.
- [ ] `@permissionlens/onchain` `enrich()`: `getCode`, the delegation indicator, EIP-1967/1167 proxy detection, `getTransactionCount`, an optional Sourcify verification lookup.
  → Only `getCode` exists today, as a Phase-1-era stub. See [`packages/onchain/src/index.ts`](../../packages/onchain/src/index.ts).
- [ ] Rules PL-7702-002/006/007/008/009/010/011/012/015.
  → None implemented yet — all require chain facts `enrich()` doesn't produce yet.
- [ ] Sweeper heuristic plus fixtures (local sweeper, benign delegate, proxy delegate) with anvil integration tests.
- [ ] `tools/census` v0: enumerate delegations for a block range, cluster, write CSV output.
  → Only a planning README exists.
- [ ] Seed ≥ 10 recognized entries from vendor sources; review top census clusters for malicious entries.
  → The 3 entries in `packages/registry/data/` are explicitly-labeled placeholders (fake addresses, `submittedBy: "placeholder"`), not real vendor data. **Do not treat them as real registry entries.**
- [ ] CI job verifying codehashes of registry entries against public RPCs (nightly, non-blocking).

## Acceptance criteria

- [ ] `permissionlens address <addr> --rpc <url>` reports "delegated to X (recognized/unknown/malicious), how to revoke." — the CLI only has a `decode` command right now, no `address` command.
- [ ] An anvil test: delegate an EOA to the sweeper fixture and PL-7702-011 fires; to the benign fixture and it doesn't.

## Dependencies

Needs Phase 1's Foundry scaffold (`contracts/`) to exist first, since the
sweeper/proxy/benign fixtures and anvil tests live there.
