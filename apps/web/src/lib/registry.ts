import { loadDefaultRegistry } from "@permissionlens/registry";

/**
 * A module-level singleton: the registry is immutable bundled data, so
 * building it once per page load (rather than per decode) avoids redoing
 * the address/codehash indexing on every keystroke.
 */
export const registry = loadDefaultRegistry();

export const REGISTRY_VERSION = "0.0.0-dev";
