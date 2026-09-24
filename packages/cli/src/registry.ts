import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadBundledRegistry } from "@permissionlens/registry";
import type { RawEntry, Registry } from "@permissionlens/registry";

/** Loads the registry package's bundled JSON data files from disk — avoids needing a bundler-level JSON glob import. */
export function loadRegistryFromPackage(): Registry {
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve("@permissionlens/registry/package.json");
  const dataDir = path.join(path.dirname(pkgJsonPath), "data");

  const entries: RawEntry[] = readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as RawEntry);

  return loadBundledRegistry(entries);
}
