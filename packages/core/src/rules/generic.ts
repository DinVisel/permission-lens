import type { Rule } from "./types.js";
import type { Finding } from "../types.js";

/** Raw `eth_sign` / arbitrary hash signing: the digest could commit to anything, including a full account takeover. */
export const PL_GEN_001: Rule = {
  id: "PL-GEN-001",
  requiredFacts: [],
  evaluate(grant): Finding | null {
    if (grant.standard !== "raw-hash") return null;
    return {
      ruleId: "PL-GEN-001",
      severity: "critical",
      confidence: "certain",
      title: "Signing a raw hash",
      detail: "You are being asked to sign a raw hash. There is no way to know what it commits to — it could authorize anything, including full account takeover.",
      evidence: {},
      grantId: grant.id,
      docsUrl: "docs/rules/PL-GEN-001.md",
    };
  },
};

export const genericRules: Rule[] = [PL_GEN_001];
