import { readFileSync } from "node:fs";
import { Command } from "commander";
import { decode, render } from "@permissionlens/core";
import type { GrantInput, RenderFormat } from "@permissionlens/core";
import { loadRegistryFromPackage } from "./registry.js";

const program = new Command();

program
  .name("permissionlens")
  .description("Decode what authority a signature grants (EIP-7702 / ERC-7710 / ERC-7715).")
  .version("0.0.0");

program
  .command("decode")
  .description("Decode a GrantInput from a JSON file, or inline JSON")
  .argument("<file-or-json>", "Path to a JSON file, or an inline JSON string, describing a GrantInput")
  .option("-f, --format <format>", "text | markdown | json", "text")
  .option("--chain-id <chainId>", "Chain ID for context", (v) => Number.parseInt(v, 10))
  .action(async (fileOrJson: string, opts: { format: RenderFormat; chainId?: number }) => {
    const raw = readInput(fileOrJson);
    let input: GrantInput;
    try {
      input = JSON.parse(raw) as GrantInput;
    } catch (err) {
      console.error(`Could not parse input as JSON: ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }

    const registry = loadRegistryFromPackage();
    const result = await decode(input, { chainId: opts.chainId, registry, registryVersion: "0.0.0-dev" });
    console.log(render(result, { format: opts.format }));

    if (result.findings.some((f) => f.severity === "critical" || f.severity === "high")) {
      process.exitCode = 2;
    }
  });

function readInput(fileOrJson: string): string {
  const trimmed = fileOrJson.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  return readFileSync(fileOrJson, "utf8");
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
