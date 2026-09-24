# contracts

Foundry project holding EIP-7702 delegate fixtures used by
`@permissionlens/core`'s golden tests (`packages/core/test/golden.test.ts`)
via `fixtures/7702/`. See IMPLEMENTATION_PLAN.md §9 (Phase 1) and §10.

## Layout

```
contracts/
├── src/fixtures/    # delegate contracts used as fixtures — not a product SDK
│   ├── BenignDelegate.sol         # stateless executor, only acts for itself
│   ├── SweeperDelegate.sol        # sends any ETH balance to a hardcoded collector
│   ├── ProxyDelegate.sol          # minimal EIP-1967 proxy
│   └── FixtureImplementation.sol  # trivial contract ProxyDelegate points at
├── script/
│   └── GenerateFixtures.s.sol  # signs 7702 authorizations to each delegate,
│                                # writes them to contracts/generated/<case>.json
└── test/
    └── Fixtures.t.sol   # sanity tests for the fixture contracts themselves
```

## Setup

```bash
forge install   # pulls lib/forge-std (a git submodule — see .gitmodules)
forge build
forge test
```

## Regenerating fixtures

```bash
forge script script/GenerateFixtures.s.sol -vvv   # from contracts/
pnpm build:fixtures                                # from the repo root
```

The Solidity script uses `vm.signDelegation` (LEARNING.md §12 Lab 1/6) to
produce signed authorization tuples with Anvil's well-known test key #0 —
the same key `packages/core`'s own tests use, so a decoded `grantor` matches
across the Solidity and TS sides — and writes them to
`contracts/generated/<case>.json` (gitignored: a build byproduct, not
source). `scripts/build-fixtures.mjs` (Node, repo root) then wraps each one
as a `GrantInput`, runs it through `@permissionlens/core`'s `decode()`, and
writes the `fixtures/7702/<case>/{input,expected}.json` pair the golden
tests read.

Review the diff before committing regenerated fixtures — `expected.json` is
a snapshot of `decode()`'s own output, not independently hand-verified, so a
bug in `decode()` could otherwise pass its own golden test silently. CI's
`fixtures-drift` job regenerates everything from scratch and fails if it
doesn't match what's committed, so fixtures can't quietly go stale relative
to the contracts and script that produce them.
