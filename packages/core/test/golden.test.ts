import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decode } from "../src/decode.js";
import type { DecodeResult, GrantInput, RegistryEntry, RegistryLookup } from "../src/index.js";

// Lives outside src/ (see vitest.config.ts's `packages/*/test/**` include)
// specifically so it can use node:fs — packages/core/src is banned from
// Node/network imports by eslint's no-restricted-imports rule, but reading
// fixture files off disk in a test is not part of the published bundle.

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "..", "..", "fixtures", "7702");

// None of the fixture delegates are registered, so a registry that always
// returns null produces the same DecodeResult as the real
// @permissionlens/registry data did when contracts/README.md's
// `pnpm build:fixtures` generated these fixtures — this keeps the golden
// test self-contained within packages/core rather than depending on the
// registry package.
class EmptyRegistry implements RegistryLookup {
  lookupAddress(): RegistryEntry | null {
    return null;
  }
}

// Matches the bigint-to-string replacer scripts/build-fixtures.mjs used
// when writing expected.json, so a fresh decode() result compares equal to
// the committed snapshot regardless of bigint vs. string representation.
function toPlain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)));
}

const cases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("golden fixtures (fixtures/7702/*, generated via contracts/script/GenerateFixtures.s.sol)", () => {
  it.each(cases)("%s matches its committed expected.json", async (caseName) => {
    const caseDir = path.join(fixturesDir, caseName);
    const input = JSON.parse(readFileSync(path.join(caseDir, "input.json"), "utf8")) as GrantInput;
    const expected = JSON.parse(readFileSync(path.join(caseDir, "expected.json"), "utf8")) as DecodeResult;

    const actual = await decode(input, { registry: new EmptyRegistry(), registryVersion: "0.0.0-dev" });

    expect(toPlain(actual)).toEqual(expected);
  });

  it("found at least one fixture case", () => {
    expect(cases.length).toBeGreaterThan(0);
  });
});
