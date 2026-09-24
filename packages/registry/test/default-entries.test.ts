import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultEntries, loadDefaultRegistry } from "../src/index.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

describe("defaultEntries", () => {
  it("has one entry per non-example file in data/", () => {
    const realFiles = readdirSync(dataDir).filter((f) => f.endsWith(".json") && !f.startsWith("example-"));
    expect(defaultEntries).toHaveLength(realFiles.length);
  });

  it("builds a working registry", () => {
    const registry = loadDefaultRegistry();
    const manager = defaultEntries.find((e) => e.kind === "delegation-manager");
    const deployment = manager?.match.deployments?.[0];
    expect(deployment).toBeDefined();
    const entry = registry.lookupAddress(deployment!.address as `0x${string}`, deployment!.chainId);
    expect(entry?.status).toBe("recognized");
  });
});
