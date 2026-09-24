import Link from "next/link";
import { listRules } from "@/lib/rules";

export const metadata = {
  title: "Rules — PermissionLens",
  description: "Every check PermissionLens can run, one page per rule ID.",
};

function groupByStandard(rules: ReturnType<typeof listRules>) {
  const groups = new Map<string, ReturnType<typeof listRules>>();
  for (const rule of rules) {
    // "PL-7702-001" -> "7702"
    const standard = rule.id.split("-")[1] ?? "other";
    const group = groups.get(standard) ?? [];
    group.push(rule);
    groups.set(standard, group);
  }
  return groups;
}

const STANDARD_LABEL: Record<string, string> = {
  "7702": "EIP-7702 (authorizations)",
  "7710": "ERC-7710 (delegations)",
  "7715": "ERC-7715 (permission requests)",
  GEN: "General",
};

export default function RulesIndex() {
  const rules = listRules();
  const groups = groupByStandard(rules);

  return (
    <main>
      <header className="site-header">
        <h1>Rules</h1>
        <p className="tagline">
          {rules.length} checks PermissionLens can run. Every finding it produces links back to the page here that
          explains why the check exists.
        </p>
      </header>

      {[...groups.entries()].map(([standard, group]) => (
        <section key={standard} className="rule-group">
          <h2>{STANDARD_LABEL[standard] ?? standard}</h2>
          <ul className="rule-list">
            {group.map((rule) => (
              <li key={rule.id}>
                <Link href={`/rules/${rule.id}`}>
                  <code>{rule.id}</code> — {rule.title}
                </Link>
                <span className={`severity-tag severity-${rule.severity.split(" ")[0]}`}>{rule.severity}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p>
        <Link href="/">← Back to the decoder</Link>
      </p>
    </main>
  );
}
