import type { Rule } from "./types.js";
import type { Finding, Restriction } from "../types.js";

function docsUrl(ruleId: string): string {
  return `docs/rules/${ruleId}.md`;
}

const AMOUNT_OR_VALUE_LIMIT_TYPES = new Set<Restriction["type"]>(["value-per-call", "native-total", "erc20-total", "calls"]);

/** No caveats at all → the delegate has unrestricted authority over the delegator. */
export const PL_7710_001: Rule = {
  id: "PL-7710-001",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.scope.type !== "full-account") return null;
    return {
      ruleId: "PL-7710-001",
      severity: "critical",
      confidence: "certain",
      title: "No caveats — unrestricted authority",
      detail: "This delegation has no caveats at all, which grants the delegate unrestricted authority to act as the delegator — every restriction in ERC-7710 lives in a caveat.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-001"),
    };
  },
};

/** delegate == ANY_DELEGATE (0x…0a11): a bearer instrument anyone holding it can redeem. */
export const PL_7710_002: Rule = {
  id: "PL-7710-002",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.grantee.type !== "anyone") return null;
    return {
      ruleId: "PL-7710-002",
      severity: "high",
      confidence: "certain",
      title: "Bearer delegation",
      detail: "This delegation's delegate is the special ANY_DELEGATE address — anyone who has the signed delegation (not just an intended recipient) can redeem it. Treat it like a bearer instrument: whoever holds it can use it.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-002"),
    };
  },
};

/** No time bound (no TimestampEnforcer, or one with before == 0): the delegation never expires on its own. */
export const PL_7710_003: Rule = {
  id: "PL-7710-003",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.scope.type !== "restricted") return null;
    const hasExpiry = grant.scope.restrictions.some((r) => r.type === "time" && r.before !== undefined);
    if (hasExpiry) return null;
    const noLimits = !hasAmountOrValueLimit(grant.scope.restrictions) && !hasTargetsRestriction(grant.scope.restrictions);
    return {
      ruleId: "PL-7710-003",
      severity: noLimits ? "high" : "medium",
      confidence: "certain",
      title: "No expiry",
      detail: "This delegation has no time bound — it stays valid indefinitely until explicitly revoked on-chain.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-003"),
    };
  },
};

/** At least one caveat's enforcer address isn't in the registry — treated as absent, per LEARNING.md §7.3. */
export const PL_7710_004: Rule = {
  id: "PL-7710-004",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.scope.type !== "restricted") return null;
    const unrecognized = grant.scope.restrictions.filter((r) => r.type === "unrecognized");
    if (unrecognized.length === 0) return null;
    return {
      ruleId: "PL-7710-004",
      severity: "high",
      confidence: "certain",
      title: "Unrecognized caveat enforcer",
      detail: `${unrecognized.length} caveat${unrecognized.length > 1 ? "s use" : " uses"} an enforcer contract this build doesn't recognize. An unrecognized enforcer is treated as providing no restriction at all — it might do nothing, or something other than what it claims to.`,
      evidence: { enforcers: unrecognized.map((r) => (r.type === "unrecognized" ? r.enforcer : undefined)) },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-004"),
    };
  },
};

/** No value/amount limit and no target restriction — the delegate can call anything, moving any amount. */
export const PL_7710_005: Rule = {
  id: "PL-7710-005",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.scope.type !== "restricted") return null;
    if (hasAmountOrValueLimit(grant.scope.restrictions) || hasTargetsRestriction(grant.scope.restrictions)) return null;
    return {
      ruleId: "PL-7710-005",
      severity: "high",
      confidence: "certain",
      title: "No value limit or target restriction",
      detail: "This delegation has caveats, but none of them limit which contracts can be called or how much value can move. Whatever restrictions exist don't bound the financial or execution scope.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-005"),
    };
  },
};

/** authority != ROOT_AUTHORITY: this is a re-delegation, passing on (a subset of) a parent's power. */
export const PL_7710_006: Rule = {
  id: "PL-7710-006",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.facts.isRootAuthority !== false) return null;
    const parentMissing = grant.facts.parentUnresolved === true;
    return {
      ruleId: "PL-7710-006",
      severity: parentMissing ? "medium" : "info",
      confidence: "certain",
      title: "Redelegation",
      detail: parentMissing
        ? "This delegation re-delegates from a parent delegation that wasn't provided alongside it — its accumulated scope (and any caveats the parent adds) can't be shown."
        : "This delegation re-delegates (a subset of) authority from a parent delegation. The true scope is the accumulation of caveats down the whole chain.",
      evidence: { authority: grant.facts.authority, parentResolved: !parentMissing },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-006"),
    };
  },
};

/** A caveat enforcer that composes/wraps other caveats' logic (e.g. LogicalOrWrapperEnforcer) is present. */
export const PL_7710_007: Rule = {
  id: "PL-7710-007",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.facts.hasCompositeLogicCaveat !== true) return null;
    return {
      ruleId: "PL-7710-007",
      severity: "medium",
      confidence: "certain",
      title: "Complex conditions",
      detail: "This delegation uses a caveat that combines or wraps other caveats' logic (e.g. an OR of conditions) instead of every caveat applying unconditionally. The effective restriction can be looser than reading each caveat alone would suggest.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-007"),
    };
  },
};

/** The EIP-712 verifyingContract isn't a registry-known DelegationManager deployment. */
export const PL_7710_008: Rule = {
  id: "PL-7710-008",
  appliesTo: ["7710"],
  requiredFacts: ["delegationManagerRecognized"],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.facts.delegationManagerRecognized !== false) return null;
    return {
      ruleId: "PL-7710-008",
      severity: "high",
      confidence: "certain",
      title: "Unrecognized DelegationManager",
      detail: `The contract this delegation is signed for (${grant.facts.delegationManager}) isn't a registry-known DelegationManager deployment. Every caveat enforcer address is only meaningful relative to the specific DelegationManager that will process the redemption — an unrecognized one means the whole delegation's behavior is unverified.`,
      evidence: { delegationManager: grant.facts.delegationManager },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-008"),
    };
  },
};

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Already expired, or expiring more than a year from now. */
export const PL_7710_009: Rule = {
  id: "PL-7710-009",
  appliesTo: ["7710"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "7710" || grant.validity.notAfter === undefined) return null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expired = grant.validity.notAfter <= nowSeconds;
    const farOut = !expired && grant.validity.notAfter - nowSeconds > ONE_YEAR_SECONDS;
    if (!expired && !farOut) return null;
    return {
      ruleId: "PL-7710-009",
      severity: expired ? "info" : "medium",
      confidence: "certain",
      title: expired ? "Already expired" : "Expires more than a year from now",
      detail: expired
        ? "This delegation's expiry has already passed — it can no longer be redeemed."
        : "This delegation doesn't expire for over a year. That's a long time for a standing authorization to remain valid.",
      evidence: { notAfter: grant.validity.notAfter },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7710-009"),
    };
  },
};

function hasAmountOrValueLimit(restrictions: Restriction[]): boolean {
  return restrictions.some((r) => AMOUNT_OR_VALUE_LIMIT_TYPES.has(r.type));
}

function hasTargetsRestriction(restrictions: Restriction[]): boolean {
  return restrictions.some((r) => r.type === "targets");
}

export const rules7710: Rule[] = [
  PL_7710_001,
  PL_7710_002,
  PL_7710_003,
  PL_7710_004,
  PL_7710_005,
  PL_7710_006,
  PL_7710_007,
  PL_7710_008,
  PL_7710_009,
];
