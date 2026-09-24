# Working conventions for this repo

## Commit after each significant improvement

Don't batch unrelated work into one large commit. Once a coherent unit of
work is complete and verified (builds, typechecks, lints, tests pass), commit
it before starting the next one. A "significant improvement" is something
like:

- A new package, module, or rule set landing and passing its tests
- A parser, the rule runner, or a renderer reaching a working state
- Config/scaffolding that unblocks the next piece of work (e.g. CI, a schema)
- A bug fix, once verified

Keep commits scoped so `git log` reads as a build order, and so a broken
change can be reverted without dragging unrelated work with it. Still ask
before pushing or force-pushing — this rule governs local commits, not
publishing them.
