# tools/census

Phase 2 scope (IMPLEMENTATION_PLAN.md §9, §7.4): scripts that enumerate
type-0x04 transactions across a block range (via RPC or a Dune export), group
delegates by `normalizedCodehash`, and rank clusters by count — the pipeline
that seeds the registry's `malicious` entries and produces the public census
dataset.
