# contracts

Foundry project for test fixtures: a benign 7702 delegate, a sweeper-pattern
delegate (for the PL-7702-011 heuristic), an EIP-1967 proxy delegate, and
(Phase 3) MetaMask Delegation Framework enforcer fixtures.

Not yet scaffolded — planned for Phase 1/2 (IMPLEMENTATION_PLAN.md §9, issues
#11-12: `forge init`, then a fixture generator script using
`vm.signDelegation` to export signed authorizations to `fixtures/`).

Foundry is available locally (`forge --version`); running `forge init` here
is the next step once the fixture contracts are designed.
