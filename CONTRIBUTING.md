# Contributing

Thanks for considering a contribution. Two kinds of change have different
bars: **code** and **registry data**.

## Code contributions

1. `pnpm install`
2. `pnpm build && pnpm test && pnpm lint && pnpm typecheck`
3. Every new rule needs: a doc page in `docs/rules/<RULE-ID>.md`, a positive
   fixture, and a negative fixture (see `fixtures/`).
4. `packages/core` must never import Node built-ins or perform network
   requests — enforced by ESLint (`no-restricted-imports`) and CI's bundle
   check. If your change needs chain data, it belongs in
   `packages/onchain`.
5. Add a changeset: `pnpm changeset`.
6. Open a PR. CI runs lint, typecheck, unit tests, `forge test`, and registry
   schema validation.

## Registry contributions

See [`GOVERNANCE.md`](GOVERNANCE.md) for the evidence and review bar for
`recognized`, `caution`, and `malicious` entries. In short:

- **recognized** — vendor-controlled evidence (official repo/docs listing the
  address) + 2 maintainer approvals. Never copy addresses from third-party
  lists.
- **malicious** — on-chain evidence (transaction hashes) + 1 maintainer
  approval.
- All registry changes must validate against
  `packages/registry/schema/entry.schema.json` in CI.

## Code of conduct

Be respectful and assume good faith, especially in registry disputes — see
the dispute process in `GOVERNANCE.md`.
