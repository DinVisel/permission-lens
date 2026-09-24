# Registry governance

The registry (`packages/registry/data/**`) is the trust-bearing part of this
project. These rules exist so a `recognized` label always means something,
and so disputes have a clear path. See IMPLEMENTATION_PLAN.md §7.3 for the
original rationale.

## Statuses

| Status | Meaning | Bar to add |
|---|---|---|
| `recognized` | The vendor's own deployment, evidenced by vendor-controlled sources | Vendor-controlled evidence (official repo or docs listing the address) **and** 2 maintainer approvals. Never assigned from a heuristic match alone. |
| `caution` | Legitimate but risky (e.g. upgradeable by a single EOA, unprotected `initialize`) | 1 maintainer approval, evidence of the risky property |
| `malicious` | Known to have stolen or swept funds | On-chain evidence (transaction hashes) **and** 1 maintainer approval |

`normalizedCodehash` matches (clones of known bytecode at unrecognized
addresses) can only ever resolve to `caution` or `malicious`, never
`recognized` — a copy of legitimate code is not the vendor's deployment.

## Review process

1. Open a PR adding/editing an entry under `packages/registry/data/`.
2. CI validates the entry against the JSON Schema and, for `recognized`
   entries, fetches the code on every listed chain to check the codehash.
3. The PR diff must be human-readable (one entry per file, minimal fields).
4. The required approvals above are collected before merge.

## Disputes

A vendor or researcher who disagrees with an entry's status opens an issue
referencing the entry. Entries carry their full history in git — nothing is
force-pushed or silently edited. Maintainers resolve disputes in the open;
contested entries stay at their current status until resolved.

## Releases

Registry releases are versioned independently (`registryVersion`), published
to npm with provenance, and also published as a signed JSON bundle so
non-JavaScript consumers (hardware wallets, other languages) can verify
integrity without depending on npm.
