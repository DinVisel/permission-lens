# Fixtures

Golden inputs and expected outputs shared by `packages/core`, `packages/cli`
and (later) `apps/web` tests. See IMPLEMENTATION_PLAN.md §10.

Layout (planned, Phase 1/2):

```
fixtures/
├── 7702/
│   ├── <case>/input.json       # a GrantInput
│   └── <case>/expected.json    # the DecodeResult it should produce
├── 7710/
└── 7715/
```

Chain-dependent fixtures (sweeper bytecode, proxy delegates, benign
delegates) are generated from `contracts/` via Foundry (Phase 2, §9).
