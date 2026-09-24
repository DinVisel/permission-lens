# Launch post (draft)

Not published. Fill in every `[TODO]` before it goes out. See
[`README.md`](README.md) for what's blocking each section.

---

## Title

PermissionLens: what authority does this signature actually grant?

## The problem

Wallets simulate transactions to show users what will happen. EIP-7702
authorizations, ERC-7710 delegations and ERC-7715 permission requests don't
*do* anything when signed — no balance moves, no state changes — so
simulators show nothing. The damage happens later, when the delegate
contract or session key is used. Users sign scope, not a transaction, and
today almost nothing decodes that scope back into plain language before the
signature happens.

## The demo

[TODO: link to the hosted web app once Phase 4's `apps/web` is deployed, and/or a
terminal recording of `permissionlens decode` on a captured phishing
authorization.]

## Census findings

[TODO: this section doesn't exist yet. It depends on `tools/census`
(currently a README stub, Phase 2) actually running against a block range
and producing real cluster/ranking numbers — normalizedCodehash clusters,
counts, chains. Do not publish this post with placeholder numbers.]

## What's in v0.1

- `@permissionlens/core` — offline parsers, IR and risk rules for
  EIP-7702, ERC-7710 and ERC-7715.
- `@permissionlens/registry` — CC0-licensed recognized/caution/malicious
  delegate and enforcer data (11 real entries as of this writing, seeded
  from MetaMask's Delegation Framework v1.3.0, plus 2 example fixtures used
  in tests — re-run `ls packages/registry/data | wc -l` before publishing
  and drop the examples from the count).
- `@permissionlens/onchain` — optional enrichment via a viem `PublicClient`.
- `@permissionlens/cli` — `permissionlens decode|address|census`.
- A MetaMask Snap giving signature insight inside MetaMask's own
  confirmation UI.

## Call for registry contributors

The registry is CC0 data anyone can consume, and it only stays useful if
vendors keep it current. If you ship a delegate implementation, caveat
enforcer, or delegation manager: [open a registry submission
issue](../../.github/ISSUE_TEMPLATE/vendor-registry-submission.yml) or a PR
directly — see [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and
[`GOVERNANCE.md`](../../GOVERNANCE.md) for the evidence bar.

## Links

- Repo: https://github.com/DinVisel/permission-lens
- Integration guide: [`docs/integration-guide.md`](../integration-guide.md)
- Rules reference: [TODO: link to the deployed `docs/rules` site from apps/web]

## Where to post

[TODO: pick venues — candidates from IMPLEMENTATION_PLAN.md §12 are the
Ethereum Magicians Clear Signing WG thread, plus wherever wallet/security
Twitter-equivalent and Farcaster audiences for this project actually are.
Confirm with the maintainer before posting anywhere; this is an external,
irreversible action.]
