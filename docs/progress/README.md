# Progress tracking

One file per phase from [`IMPLEMENTATION_PLAN.md` §9](../../IMPLEMENTATION_PLAN.md#9-phased-roadmap).
Each tracks the phase's own task list against what's actually landed in the
repo — update the checkboxes as work completes, don't let this drift.

| Phase | Status | File |
|---|---|---|
| 0 — Validate and set up | 🟡 in progress (code parts done; outreach not started) | [phase-0-validate-and-setup.md](phase-0-validate-and-setup.md) |
| 1 — 7702 core | 🟢 done | [phase-1-7702-core.md](phase-1-7702-core.md) |
| 2 — Registry v0 and on-chain enrichment | 🟡 in progress (enrichment, new rules, CLI criterion done; census + real registry data outstanding) | [phase-2-registry-onchain.md](phase-2-registry-onchain.md) |
| 3 — ERC-7710 and ERC-7715 | ⚪ not started | [phase-3-7710-7715.md](phase-3-7710-7715.md) |
| 4 — Surfaces (web app, Snap) | ⚪ not started | [phase-4-surfaces.md](phase-4-surfaces.md) |
| 5 — Launch and first integrations | ⚪ not started | [phase-5-launch.md](phase-5-launch.md) |
| 6 — Standards and expansion | ⚪ not started | [phase-6-standards-expansion.md](phase-6-standards-expansion.md) |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## How to update

- Check a box only when the thing is actually true (built, tested, or done
  in the real world for outreach items) — not when it's merely started.
- Add a one-line note under a checked box if something differs from the plan
  as written (e.g. a rule implemented ahead of its listed phase).
- When a phase's exit check is met, flip its status to 🟢 and update this table.
