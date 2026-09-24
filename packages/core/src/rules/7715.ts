import type { Rule } from "./types.js";
import type { Finding, Restriction } from "../types.js";

function docsUrl(ruleId: string): string {
  return `docs/rules/${ruleId}.md`;
}

/**
 * Permission `type` strings this build recognizes. Pinned against
 * `@metamask/7715-permission-types` / `smart-accounts-kit`'s
 * `erc7715Types.ts` as fetched 2026-09-24 (LEARNING.md §8.4: "the spec is
 * still a draft ... field names have changed across revisions. Parsers must
 * be versioned"). Other wallets may use different type strings entirely —
 * an unrecognized one isn't necessarily wrong, just unverifiable by this
 * build (PL-7715-001).
 */
export const KNOWN_PERMISSION_TYPES = new Set([
  "native-token-stream",
  "native-token-periodic",
  "native-token-allowance",
  "erc20-token-stream",
  "erc20-token-periodic",
  "erc20-token-allowance",
  "erc20-token-revocation", // deprecated in favor of token-approval-revocation, but still seen
  "token-approval-revocation",
]);

const AMOUNT_OR_RATE_TYPE = /allowance|stream|periodic/;

/** Unrecognized permission `type` — this build has no basis for knowing what it does. */
export const PL_7715_001: Rule = {
  id: "PL-7715-001",
  appliesTo: ["7715"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    const permissionType = grant.facts.permissionType;
    if (typeof permissionType !== "string" || KNOWN_PERMISSION_TYPES.has(permissionType)) return null;
    return {
      ruleId: "PL-7715-001",
      severity: "high",
      confidence: "certain",
      title: "Unrecognized permission type",
      detail: `The permission type "${permissionType}" isn't one this build recognizes. Different wallets support different permission types — this isn't necessarily wrong, but it can't be verified.`,
      evidence: { permissionType },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7715-001"),
    };
  },
};

/** No `expiry` rule in the request — the permission has no time bound at all. */
export const PL_7715_002: Rule = {
  id: "PL-7715-002",
  appliesTo: ["7715"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    const ruleTypes = grant.facts.ruleTypes;
    if (!Array.isArray(ruleTypes) || ruleTypes.includes("expiry")) return null;
    return {
      ruleId: "PL-7715-002",
      severity: "high",
      confidence: "certain",
      title: "No expiry rule",
      detail: "This permission request has no expiry rule, so the permission (if granted as requested) would have no time bound.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7715-002"),
    };
  },
};

/**
 * The response's decoded delegation chain doesn't enforce what the request
 * asked for — wider scope or a missing limit than what was requested
 * (LEARNING.md §8.4's central cross-check). Only meaningful for a response
 * grant (it has `children` — the decoded `context`).
 */
export const PL_7715_003: Rule = {
  id: "PL-7715-003",
  appliesTo: ["7715"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (!grant.children) return null; // a request, not a response — nothing to cross-check yet

    if (grant.facts.contextDecodeFailed === true) {
      return {
        ruleId: "PL-7715-003",
        severity: "critical",
        confidence: "certain",
        title: "Response context could not be decoded",
        detail: "The response's `context` couldn't be decoded into a delegation chain at all, so there's no way to confirm it actually enforces what the request asked for.",
        evidence: {},
        grantId: grant.id,
        docsUrl: docsUrl("PL-7715-003"),
      };
    }

    const restrictions: Restriction[] = grant.children.flatMap((c) => (c.scope.type === "restricted" ? c.scope.restrictions : []));
    const anyUnrestrictedChild = grant.children.some((c) => c.scope.type === "full-account");

    const missing: string[] = [];
    const permissionType = grant.facts.permissionType;
    if (typeof permissionType === "string" && AMOUNT_OR_RATE_TYPE.test(permissionType)) {
      const hasAmountOrRateLimit = restrictions.some((r) =>
        ["value-per-call", "native-total", "erc20-total", "stream", "periodic"].includes(r.type),
      );
      if (anyUnrestrictedChild || !hasAmountOrRateLimit) missing.push("an amount/rate limit");
    }

    const ruleTypes = Array.isArray(grant.facts.ruleTypes) ? grant.facts.ruleTypes : [];
    if (ruleTypes.includes("expiry")) {
      const hasExpiry = restrictions.some((r) => r.type === "time" && r.before !== undefined);
      if (anyUnrestrictedChild || !hasExpiry) missing.push("the requested expiry");
    }
    if (ruleTypes.includes("redeemer")) {
      const hasRedeemer = restrictions.some((r) => r.type === "redeemers");
      if (anyUnrestrictedChild || !hasRedeemer) missing.push("the requested redeemer restriction");
    }

    if (missing.length === 0) return null;
    return {
      ruleId: "PL-7715-003",
      severity: "critical",
      confidence: "certain",
      title: "Granted delegation is wider than what was requested",
      detail: `The request asked for ${missing.join(" and ")}, but the delegation actually being granted (decoded from \`context\`) doesn't enforce ${missing.length > 1 ? "them" : "it"}. What gets enforced on-chain is the delegation, not the request — trust the delegation.`,
      evidence: { missing, permissionType },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7715-003"),
    };
  },
};

/** `isAdjustmentAllowed: false` — the user/wallet cannot tighten the permission before granting it. */
export const PL_7715_004: Rule = {
  id: "PL-7715-004",
  appliesTo: ["7715"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.facts.isAdjustmentAllowed !== false) return null;
    return {
      ruleId: "PL-7715-004",
      severity: "info",
      confidence: "certain",
      title: "Not adjustable",
      detail: "This permission is marked as not adjustable — the user (or wallet) can't tighten its scope before granting it; it's all-or-nothing as requested.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7715-004"),
    };
  },
};

/** The response's `delegationManager` isn't a registry-known deployment. */
export const PL_7715_005: Rule = {
  id: "PL-7715-005",
  appliesTo: ["7715"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.facts.delegationManagerRecognized !== false) return null;
    return {
      ruleId: "PL-7715-005",
      severity: "high",
      confidence: "certain",
      title: "Unrecognized DelegationManager",
      detail: `The response's delegationManager (${grant.facts.delegationManager}) isn't a registry-known deployment. As with PL-7710-008, every caveat enforcer is only meaningful relative to a specific manager — an unrecognized one means the granted delegation's behavior is unverified.`,
      evidence: { delegationManager: grant.facts.delegationManager },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7715-005"),
    };
  },
};

export const rules7715: Rule[] = [PL_7715_001, PL_7715_002, PL_7715_003, PL_7715_004, PL_7715_005];
