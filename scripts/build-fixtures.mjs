// Turns contracts/generated/<case>.json (produced by
// contracts/script/GenerateFixtures.s.sol) into the golden
// fixtures/7702/<case>/{input,expected}.json pairs that
// packages/core/test/golden.test.ts reads. Run after `pnpm build` and
// `forge script script/GenerateFixtures.s.sol -vvv` (from contracts/).
//
// expected.json is a snapshot of decode()'s own output, not independently
// hand-verified — review the diff before committing a regeneration (see
// contracts/README.md and IMPLEMENTATION_PLAN.md §10's note on golden tests).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decode } from "@permissionlens/core";
import { loadBundledRegistry } from "@permissionlens/registry";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = path.join(repoRoot, "contracts", "generated");
const registryDataDir = path.join(repoRoot, "packages", "registry", "data");
const fixturesDir = path.join(repoRoot, "fixtures", "7702");

const registryEntries = readdirSync(registryDataDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(registryDataDir, f), "utf8")));
const registry = loadBundledRegistry(registryEntries);

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

for (const file of readdirSync(generatedDir)) {
  if (!file.endsWith(".json")) continue;
  const caseName = file.replace(/\.json$/, "");
  const raw = JSON.parse(readFileSync(path.join(generatedDir, file), "utf8"));

  const input = {
    kind: "7702-authorization",
    authorization: {
      chainId: raw.chainId,
      address: raw.address,
      nonce: raw.nonce,
      r: raw.r,
      s: raw.s,
      v: raw.v + 27,
    },
  };

  const expected = await decode(input, { registry, registryVersion: "0.0.0-dev" });

  const caseDir = path.join(fixturesDir, caseName);
  mkdirSync(caseDir, { recursive: true });
  writeFileSync(path.join(caseDir, "input.json"), JSON.stringify(input, jsonReplacer, 2) + "\n");
  writeFileSync(path.join(caseDir, "expected.json"), JSON.stringify(expected, jsonReplacer, 2) + "\n");
  console.log(`wrote fixtures/7702/${caseName}/{input,expected}.json`);
}
