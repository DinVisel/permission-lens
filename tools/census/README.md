# tools/census

Phase 2 scope (IMPLEMENTATION_PLAN.md §9, §7.4): enumerates type-0x04
transactions across a block range (via RPC or a pre-collected CSV, e.g. a
Dune export), groups delegates by `normalizedCodehash`, and ranks clusters
by count — the pipeline that seeds the registry's `malicious` review queue
and produces the public census dataset.

## Usage

```bash
pnpm build   # so @permissionlens/core and @permissionlens/registry have dist/

# Scan a live RPC for a block range, writing ranked clusters to a CSV:
pnpm --filter @permissionlens/census census -- \
  --rpc https://your-rpc \
  --from-block 21000000 \
  --to-block 21001000 \
  --out clusters.csv

# Merge in a pre-collected CSV (e.g. a Dune export) — columns: blockNumber,txHash,chainId,delegate[,sender]:
pnpm --filter @permissionlens/census census -- \
  --input dune-export.csv \
  --rpc https://your-rpc \
  --out clusters.csv

# Drop clusters seen fewer than N times (default 1, i.e. keep everything):
pnpm --filter @permissionlens/census census -- --rpc ... --from-block ... --out clusters.csv --min-count 3
```

`--rpc` is what enables `normalizedCodehash` clustering — it's used both to
scan blocks (if `--from-block` is given) and to fetch each unique delegate's
current bytecode. Without it (`--input` alone), clusters fall back to one
per address.

The output CSV columns: `rank, normalizedCodehash, totalCount, addressCount,
addresses, chainIds, registryStatus, registryName, sampleTxHashes`.
`registryStatus` is looked up against the bundled registry
(`@permissionlens/registry`), so a run's real signal is the clusters marked
`unknown` with a high `totalCount` — those are the review candidates for
`packages/registry/data/` (`malicious` needs on-chain evidence + 1 maintainer
approval per GOVERNANCE.md; a `recognized` deployment can never be inferred
from a codehash match alone, see `Registry.lookupNormalizedCodehash`'s doc
comment in `packages/registry/src/index.ts`).

## What this doesn't do

- It doesn't submit anything to the registry itself — reviewing a cluster
  and turning it into a `packages/registry/data/*.json` entry (with real
  evidence, i.e. transaction hashes for `malicious`) is a separate, human
  step per `GOVERNANCE.md`.
- It has no opinion on which RPC or block range to use — running this
  against real chain history to produce the actual public census dataset
  (IMPLEMENTATION_PLAN.md §9 Phase 5's "census findings") needs someone to
  pick an RPC provider and a meaningful range and actually run it; that
  hasn't happened yet.

## Tests

`test/census.test.ts` spins up a real `anvil --hardfork prague` node,
deploys the repo's compiled fixture contracts (`contracts/out/`), submits
real type-0x04 transactions, and checks that scanning + clustering finds
them and groups by delegate/codehash correctly. Run via `pnpm test` from the
repo root (needs `anvil` on `PATH` and `contracts/out/*` built, same as
`packages/onchain`'s tests).
