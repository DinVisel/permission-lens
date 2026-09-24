import { NodeType } from "@metamask/snaps-sdk";
import type { Component } from "@metamask/snaps-sdk";
import type { DecodeResult, Finding, Severity } from "@permissionlens/core";

/**
 * Builds the plain node-struct `Component` objects the Snaps insight
 * handlers expect. Deliberately not JSX: `@metamask/snaps-sdk` v12 no
 * longer exports `panel()`/`heading()`/`text()` builder functions, and
 * `onSignature`'s `content` is typed as `Component` only (not
 * `Component | JSXElement`, the way `onTransaction`'s is) — a plain-object
 * panel is the one shape valid for both handlers.
 */

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const ROW_VARIANT: Record<Severity, "critical" | "warning" | "default"> = {
  critical: "critical",
  high: "critical",
  medium: "warning",
  low: "default",
  info: "default",
};

function heading(value: string): Component {
  return { type: NodeType.Heading, value };
}

function text(value: string): Component {
  return { type: NodeType.Text, value };
}

function divider(): Component {
  return { type: NodeType.Divider };
}

function row(label: string, value: string, variant: "default" | "warning" | "critical"): Component {
  return { type: NodeType.Row, label, value: { type: NodeType.Text, value }, variant };
}

function panel(children: Component[]): Component {
  return { type: NodeType.Panel, children };
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

/** Renders a DecodeResult as a Snaps insight panel. Never claims "safe" — same rule as @permissionlens/core's render() (packages/core/src/render.ts). */
export function renderInsight(result: DecodeResult): Component {
  if (result.unsupported) {
    return panel([heading("PermissionLens"), text(`Not decoded: ${result.unsupported.reason}`)]);
  }

  if (result.grants.length === 0) {
    return panel([heading("PermissionLens"), text("No grants decoded from this request.")]);
  }

  const findings = sortFindings(result.findings);
  const children: Component[] = [heading("PermissionLens")];

  if (findings.length === 0) {
    children.push(
      text(`No issues found by ${result.checkedRuleIds.length} checks (${result.notChecked.length} not run).`),
    );
  } else {
    for (const finding of findings) {
      children.push(row(finding.ruleId, finding.title, ROW_VARIANT[finding.severity]));
      children.push(text(finding.detail));
    }
  }

  if (result.notChecked.length > 0) {
    children.push(divider());
    children.push(
      text(
        `${result.notChecked.length} check(s) not run — usually missing on-chain facts a Snap can't fetch on its own.`,
      ),
    );
  }

  return panel(children);
}

/** The onHomePage content — a static explainer, since this handler gets no request to decode. */
export function statusPanel(): Component {
  return panel([
    heading("PermissionLens"),
    text("Decodes what authority a signature grants — EIP-7702 authorizations, ERC-7710 delegations, ERC-7715 permission requests — and flags evidence-backed risks. Runs entirely offline, on-device."),
    divider(),
    text(
      "Signature insight covers eth_signTypedData_v3/v4 payloads shaped like an ERC-7710 delegation. Transaction insight for EIP-7702 authorizations isn't available yet: the Snaps transaction-insight API doesn't currently expose a transaction's authorizationList.",
    ),
  ]);
}
