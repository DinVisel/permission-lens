# Launch materials (Phase 5)

Drafts that scaffold [Phase 5's tasks](../progress/phase-5-launch.md)
(`IMPLEMENTATION_PLAN.md` §9). Nothing here has been published — each file
says what's still a placeholder and what has to happen in the real world
before it can go out.

Phase 5 depends on Phases 0–4 being substantially complete
(`docs/progress/README.md`). As of this writing that's not yet true —
Phase 0 outreach hasn't started. Phase 2's census pipeline (`tools/census`)
now exists and is tested (see `docs/progress/phase-2-registry-onchain.md`),
but nobody has pointed it at real chain history yet, so there's still no
real dataset to cite. The `[TODO]` markers below point at exactly what
unblocks each doc.

| File | Covers | Blocked on |
|---|---|---|
| [`launch-post.md`](launch-post.md) | Problem, demo, census findings, call for registry contributors | Running `tools/census` against a real RPC + block range and reviewing the output, a hosted demo (Phase 4 is built but not deployed) |
| [`integration-candidates.md`](integration-candidates.md) | Draft PR/issue text for Rabby, Frame, Blockscout | v0.1 published to npm; a maintainer with authorization to open PRs against those repos |
| [`grants.md`](grants.md) | Application notes for Gitcoin, Optimism Retro Funding, ESP, vendor grants | Integrations in progress, registry contributor count, census numbers — grant reviewers want evidence, not a plan (§12) |
