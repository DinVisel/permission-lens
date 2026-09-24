# Security policy

PermissionLens decodes signature-granting authority (EIP-7702, ERC-7710,
ERC-7715) so wallets and users can see what they are about to authorize. Bugs
here can cause **false comfort** (a real risk rendered as safe) or a missed
detection — both are security-critical, not cosmetic.

## Reporting a vulnerability

Please report privately rather than opening a public issue:

- Email: **security@permissionlens.dev** (placeholder — update once the
  domain/org exists)
- Include: affected package/version, a minimal reproduction (input payload
  and expected vs. actual decode/finding output), and impact.

We aim to acknowledge reports within 3 business days and to ship a fix or
mitigation within 30 days for high-severity issues (false-safe verdicts,
signature/digest miscomputation, registry-matching bypass).

## Scope

- `packages/core`, `packages/registry`, `packages/onchain`, `packages/cli`
- The bundled registry data (`packages/registry/data/**`)
- `apps/web`, `apps/snap` once they exist

## Out of scope

- Third-party delegate/enforcer contracts themselves (report to their
  maintainers; we track them as registry `malicious`/`caution` entries).
- Denial of service against the public web app hosting, not the library.

## Our commitments (see IMPLEMENTATION_PLAN.md §11)

- `recognized` registry status is never assigned by heuristics alone.
- The renderer never says "safe" or "secure" — this is a tested invariant.
- `packages/core` never makes network calls.
