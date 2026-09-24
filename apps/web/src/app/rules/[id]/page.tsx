import { notFound } from "next/navigation";
import Link from "next/link";
import { listRuleIds, readRule } from "@/lib/rules";
import { renderRuleMarkdown } from "@/lib/render-rule-markdown";

export function generateStaticParams() {
  return listRuleIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rule = readRule(id);
    return { title: `${rule.id} — ${rule.title} — PermissionLens` };
  } catch {
    return { title: "Rule not found — PermissionLens" };
  }
}

export default async function RulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let rule;
  try {
    rule = readRule(id);
  } catch {
    notFound();
  }

  const html = renderRuleMarkdown(rule.body);

  return (
    <main>
      <p>
        <Link href="/rules">← All rules</Link>
      </p>
      <article className="rule-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
