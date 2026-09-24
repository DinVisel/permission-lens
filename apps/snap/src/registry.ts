import { loadDefaultRegistry } from "@permissionlens/registry";

/** Built once per Snap instance — see apps/web/src/lib/registry.ts for the same pattern. */
export const registry = loadDefaultRegistry();

export const REGISTRY_VERSION = "0.0.0-dev";
