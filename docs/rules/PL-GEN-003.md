# PL-GEN-003 — Input not supported

**Severity:** info
**Confidence:** certain
**Needs chain data:** no

## Condition

`detect()` couldn't route the input to any parser — an RPC method this build
doesn't recognize, an `eth_sendTransaction` without an `authorizationList`,
or a `GrantInput.kind` not yet implemented (7710/7715 land in Phase 3).

## Why it matters

An empty result (no grants, no findings) must never be read as "nothing to
worry about." This finding, together with `DecodeResult.unsupported`, makes
"we don't know" explicit instead of silent — see rule 5 in
[§8](../../IMPLEMENTATION_PLAN.md#8-output-and-ux-rules): "unknown means
unknown," applied to the whole input, not just a single grant.

## What to do

Check `DecodeResult.unsupported.reason` for why, and fall back to whatever
this library's caller normally does for content it can't render (the
wallet's default confirmation screen, for example) — never treat it as safe
to skip a warning.
