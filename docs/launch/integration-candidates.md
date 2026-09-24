# Integration candidates (draft)

IMPLEMENTATION_PLAN.md §9 names Rabby, Frame, and Blockscout's 7702 account
view as candidates for the "≥ 2 open-source consumers" exit check. This file
drafts the issue/PR text for each so opening them is a copy-paste-and-send,
not a from-scratch write. **Nothing here has been opened.** Opening a PR or
issue against another org's repository needs an explicit go-ahead each
time — that's the org's project, not this one — and should happen after
v0.1 is actually published to npm (there's nothing to `npm install` yet).

## Rabby (github.com/RabbyHub/Rabby)

**Type:** issue with a working prototype, not a PR — Rabby's transaction
preview pipeline is large enough that a maintainer should scope the
integration point before code lands.

**Draft issue title:** Decode EIP-7702/ERC-7710/ERC-7715 grant scope in the
signing preview

**Draft issue body:**
> Rabby's transaction preview simulates state changes, which is exactly
> right for a transaction — but EIP-7702 authorizations and ERC-7710/7715
> delegations don't change state when signed, so the preview currently shows
> nothing for them. The damage happens later, when the delegate or session
> key gets used.
>
> [PermissionLens](https://github.com/DinVisel/permission-lens) is an
> offline decoder for these three: it turns the raw authorization/typed data
> into a plain-language "what authority does this grant" summary plus
> evidence-backed risk findings (unrecognized delegate, unbounded caveats,
> etc.), using `@permissionlens/core` (no network calls, `viem` peer dep
> only).
>
> [TODO once npm-published: a small runnable example — feed Rabby's existing
> 7702-authorization/7710-typed-data payload shape into
> `@permissionlens/core`'s `decode()` and show the output next to a
> screenshot of where it'd slot into the preview UI.]
>
> Happy to open a PR wiring this into the preview for authorizations
> specifically if that's a fit — wanted to check on placement/scope first.

## Frame (github.com/floating/frame)

**Type:** issue with a working prototype.

**Draft issue title:** Grant-scope summary for 7702/7710/7715 signing
requests

**Draft issue body:**
> Similar ask to what's likely worth raising with Rabby (linking that issue
> once open, for context): Frame's signing screens show simulated effects
> for transactions, but EIP-7702 authorizations and ERC-7710/7715
> delegation/permission requests don't have a state-change effect to
> simulate at sign time.
>
> [PermissionLens](https://github.com/DinVisel/permission-lens) decodes
> those three offline into an authority summary + risk findings
> (`@permissionlens/core`, `viem` peer dep only, no network calls unless you
> opt into `@permissionlens/onchain` enrichment).
>
> [TODO once npm-published: a runnable example against Frame's actual
> request shape, plus where in the signing UI this would render.]

## Blockscout (github.com/blockscout/blockscout)

**Type:** PR, since this is additive UI on an existing account page rather
than a change to a core signing flow — lower risk to propose code directly.

**Target:** the 7702 account view (delegate/authorization display on an
EOA's account page).

**Draft PR description:**
> Blockscout's 7702 account view shows the current delegate address for an
> EOA. This adds a "known delegate" badge sourced from
> `@permissionlens/registry` (CC0-licensed, vendor-evidenced data on
> recognized/caution/malicious delegate implementations) — so instead of
> just an address, the page can show e.g. "MetaMask Delegation Framework
> v1.3.0 (recognized)" or flag a `normalizedCodehash` match against a known
> malicious cluster.
>
> [TODO once npm-published and this PR is actually being drafted: the real
> diff — likely a lookup by `normalizedCodehash` against
> `@permissionlens/registry`'s data, rendered as a badge component matching
> Blockscout's existing account-page conventions.]

## Before opening any of these

1. Publish v0.1 to npm (needs the release workflow in
   `.github/workflows/release.yml` run with `NPM_TOKEN` configured, and
   someone with npm org access — see `docs/progress/phase-5-launch.md`).
2. Fill each `[TODO]` with a real, runnable example against that project's
   actual request/response shapes — not just prose.
3. Get an explicit go-ahead to open each one; these are actions on other
   organizations' repositories.
