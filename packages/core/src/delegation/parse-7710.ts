import { isAddress, isHex } from "viem";
import { z } from "zod";
import type { TypedDataDomain } from "viem";
import { isDelegationManagerDomain } from "./constants.js";
import { grantFrom7710Delegation, linkRedelegationChain } from "./from-7710.js";
import type { From7710Options } from "./from-7710.js";
import type { DelegationLike } from "./types.js";
import type { Grant, GrantInput } from "../types.js";

const address = z.string().refine((v): v is `0x${string}` => isAddress(v), "not an address");
const hex = z.string().refine((v): v is `0x${string}` => isHex(v), "not hex");

const caveatSchema = z.object({
  enforcer: address,
  terms: hex,
  args: hex.optional(),
});

const delegationMessageSchema = z.object({
  delegate: address,
  delegator: address,
  authority: hex,
  caveats: z.array(caveatSchema),
  salt: z.union([z.string(), z.number(), z.bigint()]),
  signature: hex.optional(),
});

const domainSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  chainId: z.union([z.number(), z.bigint()]).optional(),
  verifyingContract: address.optional(),
  salt: hex.optional(),
});

const typedDataSchema = z.object({
  domain: domainSchema.optional(),
  primaryType: z.string().optional(),
  message: delegationMessageSchema,
});

export class InvalidDelegationTypedDataError extends Error {}

/**
 * Duck-types just enough of an unknown `typed-data` GrantInput to route it
 * — `detect()` uses this, not the full zod validation below, so a
 * malformed payload still reaches the parser (and its proper error) rather
 * than silently falling through to "unsupported".
 */
export function looksLikeDelegationTypedData(typedData: unknown): boolean {
  if (typeof typedData !== "object" || typedData === null) return false;
  const domain = (typedData as { domain?: unknown }).domain;
  if (typeof domain !== "object" || domain === null) return false;
  const { name, version } = domain as { name?: unknown; version?: unknown };
  return name === "DelegationManager" && version === "1";
}

export interface Parse7710Options {
  registry?: import("../registry-types.js").RegistryLookup;
  chainId?: number;
  input: GrantInput;
  path: string;
}

/** Parses and validates a single signed-or-unsigned `Delegation` typed-data payload into a Grant. */
export function parse7710TypedData(typedData: unknown, options: Parse7710Options): Grant {
  const parsed = typedDataSchema.safeParse(typedData);
  if (!parsed.success) {
    throw new InvalidDelegationTypedDataError(`not a valid Delegation typed-data payload: ${parsed.error.message}`);
  }

  const domain: TypedDataDomain = parsed.data.domain ?? {};
  if (!isDelegationManagerDomain(domain)) {
    throw new InvalidDelegationTypedDataError(
      `expected domain {name: "DelegationManager", version: "1"}, got ${JSON.stringify(domain)}`,
    );
  }

  const delegation: DelegationLike = parsed.data.message;
  // The domain's chainId is the authoritative source — it's what the
  // delegation was actually signed for. options.chainId is an override for
  // callers that already know better (or need to force a lookup chain),
  // not the primary source.
  const chainId = options.chainId ?? (domain.chainId !== undefined ? Number(domain.chainId) : undefined);
  const from7710Options: From7710Options = { domain, registry: options.registry, chainId, path: options.path, input: options.input };
  return grantFrom7710Delegation(delegation, from7710Options);
}

/**
 * Parses a redelegation chain (e.g. a 7715 response `context`) — every
 * delegation decoded together so `parent`/`children` can be linked
 * (LEARNING.md §7.4).
 */
export function parse7710DelegationChain(
  delegations: DelegationLike[],
  domain: TypedDataDomain,
  options: Omit<Parse7710Options, "chainId"> & { chainId?: number },
): Grant[] {
  const chainId = options.chainId ?? (domain.chainId !== undefined ? Number(domain.chainId) : undefined);
  const grants = delegations.map((delegation, index) =>
    grantFrom7710Delegation(delegation, {
      domain,
      registry: options.registry,
      chainId,
      path: `${options.path}[${index}]`,
      input: options.input,
    }),
  );
  return linkRedelegationChain(grants);
}
