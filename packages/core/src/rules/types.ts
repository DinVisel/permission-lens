import type { Grant, Finding } from "../types.js";
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
 */
export interface Rule {
  id: string;
  requiredFacts: string[];
  evaluate(grant: Grant, ctx: RuleContext): Finding | null;
}
