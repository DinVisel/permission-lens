# Grant application notes (draft)

Per IMPLEMENTATION_PLAN.md §12. Nothing here has been submitted — these are
notes to speed up filling out each program's actual application form, which
has to be done by a human with a real identity/org behind it (grant
applications aren't something to submit on someone's behalf without them
reviewing the final text).

**What reviewers want to see (§12):** census numbers, integrations in
progress, registry contributor count, rule coverage, and the explicit
ERC-7730 gap this project fills. Most of that evidence doesn't exist yet —
see [`README.md`](README.md). Applying before it does will read as "a plan"
rather than "traction," which is weaker for all four programs below.

## Gitcoin Grants

- Track: OSS tooling (GG24 structure per §12 — verify the current round's
  track names before applying, they change per round).
- [TODO: current round dates/link once decided to apply]
- Pitch angle: offline-first, no telemetry, CC0 registry data — fits
  Gitcoin's public-goods framing directly.

## Optimism Retro Funding

- Category: developer tooling.
- Retro Funding is *retroactive* — it rewards impact already delivered, so
  this is one of the weakest fits until there's real usage (an integration
  live in a shipped wallet/explorer, not just a PR open) to point at.
- [TODO: revisit after at least one integration ships, not just "in
  progress"]

## Ethereum Foundation ESP (Ecosystem Support Program)

- Applications are open year-round (no active wishlist item for this as of
  the plan being written — verify current state before applying).
- ESP's stated preference (quoted in §12): "a clear path to adoption,
  usability testing, and real integration."
- Strongest evidence to cite: Phase 0's exit check (integrator interviews)
  and Phase 5's exit check (≥1 integration in progress, ≥3 registry PRs) —
  both need to actually be true first.
- [TODO: draft the actual application narrative once those exit checks are
  met]

## Vendor grants

- Candidates: smart-account/wallet vendors whose delegate implementations
  are in the registry and who'd benefit from being the "recognized" default
  (e.g. MetaMask, given the Delegation Framework entries already in
  `packages/registry/data/`).
- Angle: registry maintenance and accuracy directly benefits them — a
  wrong/missing entry for their contracts is a support burden they'd
  otherwise own.
- [TODO: identify specific vendor grant programs once a vendor relationship
  exists — this is closer to a warm outreach ask than a cold-form
  application]

## Before submitting anything

1. Get the evidence (§12 list) to actually exist — see the blockers table in
   [`README.md`](README.md).
2. Have the maintainer review and submit each application personally;
   grant forms usually require a named individual/org and often KYC-style
   info that shouldn't be filled in by an agent.
