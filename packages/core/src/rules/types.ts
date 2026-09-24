import type { Grant, Finding, Standard } from "../types.js";
import type { RegistryLookup } from "../registry-types.js";

export interface RuleContext {
  chainId?: number;
  registry?: RegistryLookup;
}

/**
 * A rule is a pure function. `requiredFacts` lists keys the rule reads off
 * `grant.facts` — the runner skips (and reports as `notChecked`) any rule
 * whose facts are missing instead of silently passing it
 * (IMPLEMENTATION_PLAN.md §6, §8.6: "degrade visibly").
 *
 * `appliesTo` restricts which `Grant.standard`s the rule is even considered
 * for. Omit it only for a genuinely standard-neutral rule (the PL-GEN-*
 * family) — every standard-specific rule should set it. Without this, a
 * rule with non-empty `requiredFacts` would show up as "not checked" on
 * every grant of every OTHER standard too (e.g. a 7710-only fact reported
 * as missing on a 7702 grant, where it will never exist), which is noise,
 * not an honest gap.
 */
export interface Rule {
  id: string;
  requiredFacts: string[];
  appliesTo?: Standard[];
  evaluate(grant: Grant, ctx: RuleContext): Finding | null;
}
