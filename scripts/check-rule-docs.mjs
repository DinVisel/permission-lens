// Enforces the testing-strategy invariant (IMPLEMENTATION_PLAN.md §10):
// "every rule ID documented". Run after `pnpm build` so @permissionlens/core/dist exists.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allRules } from "@permissionlens/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesDir = path.join(here, "..", "docs", "rules");
const documented = new Set(readdirSync(rulesDir).map((f) => f.replace(/\.md$/, "")));

const missing = allRules.map((r) => r.id).filter((id) => !documented.has(id));

if (missing.length > 0) {
  console.error(`Rules missing a docs page in docs/rules/: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`All ${allRules.length} rules have a docs page.`);
