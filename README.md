# PermissionLens

An open-source, offline-first decoder that tells you **what authority a
signature grants** — for EIP-7702 authorizations, ERC-7710 delegations and
ERC-7715 permission requests — with evidence-backed risk flags that wallets,
explorers and security tools can embed.

> Signing a grant moves nothing, so simulators show no effect. Damage happens
> later. Grants need scope analysis, not transaction simulation.

**Status:** early development (Phase 4 — see
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) and the
[phase-by-phase progress tracker](docs/progress/README.md)). Background
reading on 7702/7710/7715 and how they get abused is in
[`LEARNING.md`](LEARNING.md).

## Packages

| Package | Purpose |
|---|---|
| [`@permissionlens/core`](packages/core) | Parsers, IR, rules, renderers. Offline, `viem` peer dep only. |
| [`@permissionlens/registry`](packages/registry) | Recognized/malicious delegate & enforcer data, CC0-licensed. |
| [`@permissionlens/onchain`](packages/onchain) | Optional enrichment using a `viem` `PublicClient`. |
| [`@permissionlens/cli`](packages/cli) | `permissionlens decode\|address\|census` |
| [`apps/web`](apps/web) | Paste-a-request / check-an-address web app, and the [rules reference site](docs/rules). |

Adding this to your own wallet's signing screen? See the
[integration guide](docs/integration-guide.md).

## Development

```bash
corepack enable
pnpm install
pnpm build
pnpm test
```

## License

Code is dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE),
at your option. Registry data (`packages/registry/data/**`) is
[CC0-1.0](registry/LICENSE).

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`GOVERNANCE.md`](GOVERNANCE.md) and
[`SECURITY.md`](SECURITY.md).
