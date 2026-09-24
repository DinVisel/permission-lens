import { marked } from "marked";
import "server-only";

/**
 * Renders a rule doc's markdown to HTML for the rules site. Safe to use
 * `dangerouslySetInnerHTML` with the result: the input is always our own
 * `docs/rules/*.md` files (build-time content from the repo, never anything
 * a visitor supplied), not user input — unlike the paste-decode tab, which
 * never renders arbitrary text as HTML at all.
 */
export function renderRuleMarkdown(markdown: string): string {
  // docs/rules/*.md cross-links other rule docs as bare relative paths
  // ("PL-7702-004.md") — rewrite those to this site's /rules/<id> route.
  const rewritten = markdown.replace(/\]\((PL-[\w-]+)\.md\)/g, "](/rules/$1)");
  return marked.parse(rewritten, { async: false });
}
