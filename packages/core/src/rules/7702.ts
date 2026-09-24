import type { Hex } from "viem";
import type { Rule } from "./types.js";
import type { Finding } from "../types.js";
import { crudeSweeperHeuristic } from "../bytecode/sweeper-heuristic.js";

function docsUrl(ruleId: string): string {
  return `docs/rules/${ruleId}.md`;
}

/** chain_id == 0 → the authorization is valid on every chain that ever accepts it. */
export const PL_7702_001: Rule = {
  id: "PL-7702-001",
  appliesTo: ["7702"],
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

/** Delegate matches a registry entry with `status: malicious` — by address (offline) or by codehash/normalizedCodehash (needs `@permissionlens/onchain` enrichment first). */
export const PL_7702_002: Rule = {
  id: "PL-7702-002",
  appliesTo: ["7702"],
  requiredFacts: ["registryStatus"],
  evaluate(grant): Finding | null {
    if (grant.facts.registryStatus !== "malicious") return null;
    const delegate = grant.grantee.type === "code" ? grant.grantee.address : undefined;
    return {
      ruleId: "PL-7702-002",
      severity: "critical",
      confidence: "certain",
      title: "Known-malicious code",
      detail: `${grant.facts.registryName ?? `The code at ${delegate}`} is a known-malicious implementation in the registry.`,
      evidence: { name: grant.facts.registryName, delegate },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-002"),
    };
  },
};

/** Delegate not found in the registry at all. */
export const PL_7702_003: Rule = {
  id: "PL-7702-003",
  appliesTo: ["7702"],
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
  appliesTo: ["7702"],
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
  appliesTo: ["7702"],
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
  appliesTo: ["7702"],
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
  appliesTo: ["7702"],
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

/** No code deployed at the delegate address on the target chain (yet). Needs `codeAt` from `@permissionlens/onchain` enrichment. */
export const PL_7702_006: Rule = {
  id: "PL-7702-006",
  appliesTo: ["7702"],
  requiredFacts: ["codeAt"],
  evaluate(grant): Finding | null {
    if (grant.facts.codeAt !== "0x") return null;
    const delegate = grant.grantee.type === "code" ? grant.grantee.address : undefined;
    return {
      ruleId: "PL-7702-006",
      severity: "high",
      confidence: "certain",
      title: "No code at the delegate yet",
      detail: `There is no contract deployed at ${delegate} on this chain right now. Code could still be deployed there later — this authorization would then hand it control.`,
      evidence: { delegate },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-006"),
    };
  },
};

/** Delegate is a proxy (EIP-1967 or EIP-1167). Needs `isProxy`/`proxyImplementation` from enrichment. */
export const PL_7702_007: Rule = {
  id: "PL-7702-007",
  appliesTo: ["7702"],
  requiredFacts: ["isProxy"],
  evaluate(grant): Finding | null {
    if (grant.facts.isProxy !== true) return null;
    const implementation = grant.facts.proxyImplementation;
    return {
      ruleId: "PL-7702-007",
      severity: "medium",
      confidence: "certain",
      title: "Delegate is a proxy",
      detail: implementation
        ? `The delegate is a proxy currently pointing at ${implementation}. Whoever can upgrade the proxy controls what it does next — that may not be the same code being reviewed here.`
        : "The delegate is a proxy. Whoever can upgrade it controls what it does next.",
      evidence: { implementation },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-007"),
    };
  },
};

/** Tuple nonce is more than 1 ahead of the account's current nonce — a pre-signed authorization saved for later use. Needs `currentNonce` from enrichment. */
export const PL_7702_009: Rule = {
  id: "PL-7702-009",
  appliesTo: ["7702"],
  requiredFacts: ["currentNonce"],
  evaluate(grant): Finding | null {
    const tupleNonce = grant.replay.nonce;
    const currentNonce = grant.facts.currentNonce;
    if (tupleNonce === undefined || typeof currentNonce !== "bigint") return null;
    if (tupleNonce <= currentNonce + 1n) return null;
    return {
      ruleId: "PL-7702-009",
      severity: "medium",
      confidence: "certain",
      title: "Pre-signed for later use",
      detail: `This authorization's nonce (${tupleNonce}) is ahead of the account's current nonce (${currentNonce}). It was signed to be used later, once other transactions bring the nonce up to it — not necessarily by you.`,
      evidence: { tupleNonce, currentNonce },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-009"),
    };
  },
};

/** Tuple nonce is behind the account's current nonce — already unusable. Needs `currentNonce` from enrichment. */
export const PL_7702_010: Rule = {
  id: "PL-7702-010",
  appliesTo: ["7702"],
  requiredFacts: ["currentNonce"],
  evaluate(grant): Finding | null {
    const tupleNonce = grant.replay.nonce;
    const currentNonce = grant.facts.currentNonce;
    if (tupleNonce === undefined || typeof currentNonce !== "bigint") return null;
    if (tupleNonce >= currentNonce) return null;
    return {
      ruleId: "PL-7702-010",
      severity: "info",
      confidence: "certain",
      title: "Already unusable",
      detail: `This authorization's nonce (${tupleNonce}) is behind the account's current nonce (${currentNonce}), so it can no longer be applied.`,
      evidence: { tupleNonce, currentNonce },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-010"),
    };
  },
};

/** The delegate's bytecode matches the crude sweeper pattern. Needs `codeAt` from enrichment. */
export const PL_7702_011: Rule = {
  id: "PL-7702-011",
  appliesTo: ["7702"],
  requiredFacts: ["codeAt"],
  evaluate(grant): Finding | null {
    const codeAt = grant.facts.codeAt;
    if (typeof codeAt !== "string" || codeAt === "0x") return null;
    const heuristic = crudeSweeperHeuristic(codeAt as Hex);
    if (!heuristic.matched) return null;
    const delegate = grant.grantee.type === "code" ? grant.grantee.address : undefined;
    return {
      ruleId: "PL-7702-011",
      severity: "critical",
      confidence: "heuristic",
      title: "Matches a sweeper pattern",
      detail: `The code at ${delegate} pushes a hardcoded address (${heuristic.address}) right before a call that can move value — the pattern used by contracts that sweep an account's balance to an attacker. This is a heuristic, not a certainty: review before trusting it either way.`,
      evidence: { delegate, sweepTarget: heuristic.address },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-011"),
    };
  },
};

/** Registry says the delegate has unprotected initialization or non-namespaced storage. Pure registry data — no chain access needed. */
export const PL_7702_015: Rule = {
  id: "PL-7702-015",
  appliesTo: ["7702"],
  requiredFacts: [],
  evaluate(grant): Finding | null {
    const unprotectedInit = grant.facts.registryInitialization === "unprotected";
    const plainStorage = grant.facts.registryStorage === "plain";
    if (!unprotectedInit && !plainStorage) return null;

    const problems = [
      unprotectedInit && "its initializer isn't signature-protected, so anyone can call it first (front-running init)",
      plainStorage && "it doesn't use namespaced storage, so switching from a prior delegate could misread leftover storage",
    ].filter(Boolean);

    return {
      ruleId: "PL-7702-015",
      severity: "medium",
      confidence: "certain",
      title: "Registry flags a storage/init risk",
      detail: `The registry notes that ${problems.join("; and ")}.`,
      evidence: { unprotectedInit, plainStorage },
      grantId: grant.id,
      docsUrl: docsUrl("PL-7702-015"),
    };
  },
};

export const rules7702: Rule[] = [
  PL_7702_001,
  PL_7702_002,
  PL_7702_003,
  PL_7702_004,
  PL_7702_005,
  PL_7702_006,
  PL_7702_007,
  PL_7702_009,
  PL_7702_010,
  PL_7702_011,
  PL_7702_013,
  PL_7702_014,
  PL_7702_015,
];
