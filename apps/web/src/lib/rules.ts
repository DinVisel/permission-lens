import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import "server-only";

/**
 * Reads docs/rules/*.md — this is what docs/progress/phase-4-surfaces.md
 * means by "publish them as a site, not writing them from scratch": the
 * pages already exist per rule ID from Phase 1, this just serves them.
 * Node-only (readFileSync), so every caller must be a Server Component.
 */
const RULES_DIR = path.join(process.cwd(), "..", "..", "docs", "rules");

export interface RuleMeta {
  id: string;
  title: string;
  severity: string;
  confidence: string;
  needsChainData: string;
}

export interface RuleDoc extends RuleMeta {
  body: string;
}

const TITLE_RE = /^#\s+([\w-]+)\s+—\s+(.+)$/m;
const SEVERITY_RE = /^\*\*Severity:\*\*\s*(.+)$/m;
const CONFIDENCE_RE = /^\*\*Confidence:\*\*\s*(.+)$/m;
const NEEDS_CHAIN_DATA_RE = /^\*\*Needs chain data:\*\*\s*(.+)$/m;

function parse(raw: string, fallbackId: string): RuleDoc {
  const titleMatch = TITLE_RE.exec(raw);
  return {
    id: titleMatch?.[1] ?? fallbackId,
    title: titleMatch?.[2]?.trim() ?? fallbackId,
    severity: SEVERITY_RE.exec(raw)?.[1]?.trim() ?? "unknown",
    confidence: CONFIDENCE_RE.exec(raw)?.[1]?.trim() ?? "unknown",
    needsChainData: NEEDS_CHAIN_DATA_RE.exec(raw)?.[1]?.trim() ?? "unknown",
    body: raw,
  };
}

export function listRuleIds(): string[] {
  return readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export function listRules(): RuleMeta[] {
  return listRuleIds().map((id) => {
    const doc = readRule(id);
    return { id: doc.id, title: doc.title, severity: doc.severity, confidence: doc.confidence, needsChainData: doc.needsChainData };
  });
}

export function readRule(id: string): RuleDoc {
  const raw = readFileSync(path.join(RULES_DIR, `${id}.md`), "utf8");
  return parse(raw, id);
}
