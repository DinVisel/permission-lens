import type { Rule } from "./types.js";
import type { Finding } from "../types.js";

function docsUrl(ruleId: string): string {
  return `docs/rules/${ruleId}.md`;
}

/** chain_id == 0 → the authorization is valid on every chain that ever accepts it. */
export const PL_7702_001: Rule = {
  id: "PL-7702-001",
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.chains.type !== "all") return null;
    const delegate = grant.grantee.type === "code" ? grant.grantee.address : undefined;
    const recognized = grant.facts.registryStatus === "recognized";
    return {
      ruleId: "PL-7702-001",
      severity: recognized ? "high" : "critical",
      confidence: "certain",
      title: "Valid on every chain",
      detail: delegate
        ? `This authorization has no chain restriction: it hands control to the code at ${delegate} on every chain where your account exists, not just this one.`
        : "This authorization has no chain restriction (chain_id = 0).",
      evidence: { chainId: 0 },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-001"),
    };
  },
};

/** Delegate not found in the registry at all. */
export const PL_7702_003: Rule = {
  id: "PL-7702-003",
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.grantee.type !== "code") return null;
    if (grant.facts.registryStatus !== undefined) return null; // registered (any status) — handled by 002/004
    return {
      ruleId: "PL-7702-003",
      severity: "high",
      confidence: "certain",
      title: "Unrecognized code",
      detail: `The code at ${grant.grantee.address} is not in the registry. Nothing is known about what it does with your account.`,
      evidence: { delegate: grant.grantee.address },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-003"),
    };
  },
};

/** Delegate matches a `recognized` registry entry. */
export const PL_7702_004: Rule = {
  id: "PL-7702-004",
  requiredFacts: ["registryStatus"],
  evaluate(grant): Finding | null {
    if (grant.facts.registryStatus !== "recognized") return null;
    return {
      ruleId: "PL-7702-004",
      severity: "info",
      confidence: "certain",
      title: "Recognized code",
      detail: `${grant.facts.registryName ?? "This code"} is a recognized implementation${grant.facts.registryVendor ? ` from ${grant.facts.registryVendor}` : ""}.`,
      evidence: { name: grant.facts.registryName, vendor: grant.facts.registryVendor },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-004"),
    };
  },
};

/** Delegate is the zero address — this authorization clears an existing delegation. */
export const PL_7702_005: Rule = {
  id: "PL-7702-005",
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.scope.type !== "revoke") return null;
    return {
      ruleId: "PL-7702-005",
      severity: "info",
      confidence: "certain",
      title: "Revokes delegation",
      detail: "This authorization sets the delegate to the zero address, which clears any existing delegation on this account.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-005"),
    };
  },
};

/** The authorization traveled inside a transaction sent by a different account. */
export const PL_7702_013: Rule = {
  id: "PL-7702-013",
  requiredFacts: ["relayed"],
  evaluate(grant): Finding | null {
    if (grant.facts.relayed !== true) return null;
    return {
      ruleId: "PL-7702-013",
      severity: "info",
      confidence: "certain",
      title: "Relayed authorization",
      detail: "This authorization was submitted by a different account than the one that signed it. That's normal for gas-sponsored upgrades, but also how a stolen or phished signature gets used.",
      evidence: {},
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-013"),
    };
  },
};

/** Malformed signature: high-s, bad yParity, or recovered address disagrees with the declared authority. */
export const PL_7702_014: Rule = {
  id: "PL-7702-014",
  requiredFacts: [],
  evaluate(grant): Finding | null {
    const highS = grant.facts.lowS === false;
    const badYParity = grant.facts.signatureMalformed === true;
    const mismatch = grant.facts.recoveredMatchesDeclared === false;
    if (!highS && !badYParity && !mismatch) return null;

    const problems = [
      highS && "s is not in the lower half of the curve order (high-s)",
      badYParity && "yParity is not 0 or 1",
      mismatch && "the recovered signer does not match the declared authority",
    ].filter(Boolean);

    return {
      ruleId: "PL-7702-014",
      severity: "medium",
      confidence: "certain",
      title: "Malformed signature",
      detail: `This authorization's signature is malformed: ${problems.join("; ")}. A node would reject it, so it will not be usable as-is.`,
      evidence: { highS, badYParity, mismatch },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-014"),
    };
  },
};

export const rules7702: Rule[] = [
  PL_7702_001,
  PL_7702_003,
  PL_7702_004,
  PL_7702_005,
  PL_7702_013,
  PL_7702_014,
];
