import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const schemaPath = path.join(here, "..", "schema", "entry.schema.json");

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = ajv.compile(schema);

let failures = 0;
const seenNormalizedRecognized = [];

for (const file of readdirSync(dataDir)) {
  if (!file.endsWith(".json")) continue;
  const full = path.join(dataDir, file);
  const entry = JSON.parse(readFileSync(full, "utf8"));

  if (!validate(entry)) {
    failures++;
    console.error(`✗ ${file}`);
    for (const err of validate.errors ?? []) {
      console.error(`  ${err.instancePath || "/"} ${err.message}`);
    }
    continue;
  }

  if (entry.status === "recognized" && entry.match.normalizedCodehash && !entry.match.deployments?.length && !entry.match.codehash) {
    failures++;
    console.error(`✗ ${file}: status=recognized must not be reachable only via normalizedCodehash (GOVERNANCE.md)`);
    continue;
  }

  console.log(`✓ ${file}`);
}

if (failures > 0) {
  console.error(`\n${failures} entr${failures === 1 ? "y" : "ies"} failed validation.`);
  process.exit(1);
}

console.log("\nAll registry entries valid.");
