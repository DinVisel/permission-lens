import type { DecodeResult, Finding, Severity } from "./types.js";

export type RenderFormat = "text" | "markdown" | "json";

export interface RenderOptions {
  format: RenderFormat;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRITICAL RISK",
  high: "HIGH RISK",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

/**
 * Renders a DecodeResult. Rule 1 (§8): never say "safe" or "secure" — the
 * best verdict this function produces is "No issues found by N checks (M not
 * run)", so a clean result is never mistaken for a guarantee.
 */
export function render(result: DecodeResult, options: RenderOptions): string {
  if (options.format === "json") {
    return JSON.stringify(result, jsonReplacer, 2);
  }
  return renderText(result);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function renderText(result: DecodeResult): string {
  const lines: string[] = [];

  if (result.unsupported) {
    lines.push(`UNSUPPORTED — ${result.unsupported.reason}`);
    return lines.join("\n");
  }

  if (result.grants.length === 0) {
    lines.push("No grants decoded from this input.");
    return lines.join("\n");
  }

  const findings = sortFindings(result.findings);
  if (findings.length === 0) {
    lines.push(`No issues found by ${result.checkedRuleIds.length} checks (${result.notChecked.length} not run).`);
  } else {
    const topSeverity = findings[0]!.severity;
    lines.push(`${SEVERITY_LABEL[topSeverity]}`);
    lines.push("");
    for (const finding of findings) {
      lines.push(`[${finding.severity.toUpperCase()} · ${finding.ruleId}] ${finding.title}`);
      lines.push(`  ${finding.detail}`);
    }
  }

  if (result.notChecked.length > 0) {
    lines.push("");
    lines.push(`Checks not run: ${result.notChecked.map((n) => `${n.ruleId} (needs ${n.missingFacts.join(", ")})`).join("; ")}`);
  }

  return lines.join("\n");
}
