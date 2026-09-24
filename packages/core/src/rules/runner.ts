import type { Grant, Finding, NotChecked } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

export function runRules(
  grants: Grant[],
  rules: Rule[],
  ctx: RuleContext,
): { findings: Finding[]; notChecked: NotChecked[]; checkedRuleIds: string[] } {
  const findings: Finding[] = [];
  const notCheckedByRule = new Map<string, Set<string>>();
  const checkedRuleIds = new Set<string>();

  for (const grant of grants) {
    for (const rule of rules) {
      const missing = rule.requiredFacts.filter((fact) => !(fact in grant.facts));
      if (missing.length > 0) {
        const set = notCheckedByRule.get(rule.id) ?? new Set<string>();
        for (const fact of missing) set.add(fact);
        notCheckedByRule.set(rule.id, set);
        continue;
      }

      checkedRuleIds.add(rule.id);
      const finding = rule.evaluate(grant, ctx);
      if (finding) findings.push(finding);
    }
  }

  const notChecked: NotChecked[] = [...notCheckedByRule.entries()].map(([ruleId, facts]) => ({
    ruleId,
    missingFacts: [...facts],
  }));

  return { findings, notChecked, checkedRuleIds: [...checkedRuleIds] };
}
