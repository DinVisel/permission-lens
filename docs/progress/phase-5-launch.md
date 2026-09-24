# Phase 5 — Launch and first integrations

Weeks 17–20. Source: [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#phase-5--launch-and-first-integrations-weeks-1720).

**Status:** 🟡 in progress (scaffolding landed; every outreach/publish task is
still an external, real-world action nobody has taken yet).

## Tasks

- [ ] Publish v0.1 of all packages with npm provenance; tag registry v1.
      Provenance publishing is wired up in
      [`.github/workflows/release.yml`](../../.github/workflows/release.yml)
      (changesets + `pnpm release`, `id-token: write`, `NPM_CONFIG_PROVENANCE`).
      Still needs: an `NPM_TOKEN` secret with publish access, a first
      `pnpm changeset`, and someone to actually merge the resulting
      "Version Packages" PR. Nothing has been published.
- [ ] Launch post: problem, demo, census findings, call for registry contributors.
      Drafted at [`docs/launch/launch-post.md`](../launch/launch-post.md) —
      the census-findings section is a placeholder because
      `tools/census` (Phase 2) hasn't been built yet.
- [ ] Open integration PRs (or issues with a working prototype) for ≥ 2 open-source consumers (Rabby, Frame, Blockscout's 7702 account view).
      Draft issue/PR text for all three at
      [`docs/launch/integration-candidates.md`](../launch/integration-candidates.md).
      None opened — blocked on v0.1 being on npm and a maintainer go-ahead.
- [ ] Apply for grants (§12: Gitcoin, Optimism Retro Funding, ESP, vendor grants).
      Notes per program at [`docs/launch/grants.md`](../launch/grants.md).
      None submitted — the evidence these programs ask for (census numbers,
      live integrations, registry contributor count) doesn't exist yet.
- [x] Office hours or an issue template for vendors adding their deployments.
      Added
      [`.github/ISSUE_TEMPLATE/vendor-registry-submission.yml`](../../.github/ISSUE_TEMPLATE/vendor-registry-submission.yml)
      (plus `config.yml` linking to the registry dispute process and
      security policy).

## Exit check

> At least one external integration in progress, and at least 3 external registry PRs.

Not met.

## Dependencies

Needs Phases 0–4 substantially complete — see
[`docs/progress/README.md`](README.md). As of this writing Phase 0 outreach
hasn't started and Phase 2's census tool + real dataset are still
outstanding, so the launch-post and grant-application content can't be
finished honestly yet even though the publishing/issue-template
infrastructure is ready.
