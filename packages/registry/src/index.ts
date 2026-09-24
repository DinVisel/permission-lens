import type { RegistryEntry, RegistryLookup } from "@permissionlens/core";
import { defaultEntries } from "./default-entries.js";

export type { RegistryEntry, RegistryLookup } from "@permissionlens/core";

export interface RawEntry {
  schemaVersion: 1;
  kind: "delegate-implementation" | "caveat-enforcer" | "delegation-manager";
  name: string;
  vendor?: string;
  version?: string;
  status: "recognized" | "caution" | "malicious";
  match: {
    deployments?: { chainId: number; address: string }[];
    codehash?: string;
    normalizedCodehash?: string;
  };
  properties?: RegistryEntry["properties"];
  decoder?: string | null;
  evidence?: { type: string; url: string }[];
  review: { submittedBy: string; reviewers: string[]; date: string };
}

function toRegistryEntry(raw: RawEntry): RegistryEntry {
  return {
    name: raw.name,
    vendor: raw.vendor,
    version: raw.version,
    status: raw.status,
    kind: raw.kind,
    decoder: raw.decoder,
    properties: raw.properties,
    evidence: raw.evidence,
  };
}

/**
 * Matching order per IMPLEMENTATION_PLAN.md §7.2: exact (chainId, address)
 * deployment, then exact codehash, then normalizedCodehash. A
 * normalizedCodehash match can only ever resolve to `caution` or
 * `malicious` — a clone of legitimate code at an unrecognized address is not
 * the vendor's deployment, so a `recognized` entry is never reachable
 * through that path.
 */
export class Registry implements RegistryLookup {
  private byDeployment = new Map<string, RawEntry>();
  private byCodehash = new Map<string, RawEntry>();
  private byNormalizedCodehash = new Map<string, RawEntry>();

  constructor(entries: RawEntry[]) {
    for (const entry of entries) {
      for (const deployment of entry.match.deployments ?? []) {
        this.byDeployment.set(deploymentKey(deployment.chainId, deployment.address), entry);
      }
      if (entry.match.codehash) {
        this.byCodehash.set(entry.match.codehash.toLowerCase(), entry);
      }
      if (entry.match.normalizedCodehash) {
        this.byNormalizedCodehash.set(entry.match.normalizedCodehash.toLowerCase(), entry);
      }
    }
  }

  lookupAddress(address: string, chainId?: number): RegistryEntry | null {
    if (chainId !== undefined) {
      const byDeployment = this.byDeployment.get(deploymentKey(chainId, address));
      if (byDeployment) return toRegistryEntry(byDeployment);
    }
    return null;
  }

  lookupCodehash(codehash: string): RegistryEntry | null {
    const entry = this.byCodehash.get(codehash.toLowerCase());
    return entry ? toRegistryEntry(entry) : null;
  }

  /** Never returns a `recognized` entry — see the class doc comment. */
  lookupNormalizedCodehash(normalizedCodehash: string): RegistryEntry | null {
    const entry = this.byNormalizedCodehash.get(normalizedCodehash.toLowerCase());
    if (!entry) return null;
    if (entry.status === "recognized") {
      throw new Error(
        `registry data error: entry "${entry.name}" is status=recognized but only reachable via normalizedCodehash — see GOVERNANCE.md`,
      );
    }
    return toRegistryEntry(entry);
  }
}

function deploymentKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function loadBundledRegistry(entries: RawEntry[]): Registry {
  return new Registry(entries);
}

/**
 * The `data/` entries bundled at build time via static JSON imports — safe
 * for a browser, a Snap, or anywhere else without filesystem access. Node
 * consumers that want the raw files on disk (e.g. to add ones dropped in
 * after publish) should use the CLI's `loadRegistryFromPackage()` instead.
 */
export function loadDefaultRegistry(): Registry {
  return new Registry(defaultEntries);
}

export { defaultEntries } from "./default-entries.js";
