# Fixtures

Golden inputs and expected outputs, generated from `contracts/` and read by
`packages/core/test/golden.test.ts`. See IMPLEMENTATION_PLAN.md §10 and
`contracts/README.md` for how to regenerate.

```
fixtures/
└── 7702/
    ├── benign-chain-scoped/{input,expected}.json
    ├── proxy-chain-scoped/{input,expected}.json
    └── sweeper-all-chains/{input,expected}.json
```

`input.json` is a `GrantInput`; `expected.json` is the `DecodeResult`
`@permissionlens/core`'s `decode()` produces for it (see the caveat in
`contracts/README.md` about `expected.json` being a snapshot, not an
independently hand-verified oracle).

`fixtures/7710/` and `fixtures/7715/` will follow the same shape once their
parsers exist (Phase 3).
