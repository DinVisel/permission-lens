import type { DecodeResult, Finding, Severity } from "@permissionlens/core";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export function ResultView({ result }: { result: DecodeResult }) {
  if (result.unsupported) {
    return (
      <div className="panel">
        <p>
          <strong>Not supported.</strong> {result.unsupported.reason}
        </p>
      </div>
    );
  }

  if (result.grants.length === 0) {
    return (
      <div className="panel">
        <p>No grants decoded from this input.</p>
      </div>
    );
  }

  const findings = sortFindings(result.findings);

  return (
    <div className="panel">
      {findings.length === 0 ? (
        <p className="clean-result">
          No issues found by {result.checkedRuleIds.length} checks ({result.notChecked.length} not run). This is not a
          safety guarantee — it means the checks that ran found nothing.
        </p>
      ) : (
        <ul className="findings">
          {findings.map((finding, i) => (
            <li key={`${finding.ruleId}-${i}`} className={`finding severity-${finding.severity}`}>
              <div className="finding-head">
                <span className="severity-badge">{SEVERITY_LABEL[finding.severity]}</span>
                <span className="rule-id">{finding.ruleId}</span>
                {finding.confidence === "heuristic" && <span className="heuristic-badge">heuristic</span>}
              </div>
              <div className="finding-title">{finding.title}</div>
              <div className="finding-detail">{finding.detail}</div>
              <a className="docs-link" href={finding.docsUrl} target="_blank" rel="noreferrer noopener">
                Why this check exists →
              </a>
            </li>
          ))}
        </ul>
      )}

      {result.notChecked.length > 0 && (
        <details className="not-checked">
          <summary>{result.notChecked.length} checks not run</summary>
          <ul>
            {result.notChecked.map((n) => (
              <li key={n.ruleId}>
                <code>{n.ruleId}</code> — needs {n.missingFacts.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="grants-detail">
        <summary>{result.grants.length} grant(s) decoded</summary>
        <pre>{JSON.stringify(result.grants, jsonReplacer, 2)}</pre>
      </details>
    </div>
  );
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
