import { isAddress, isHex } from "viem";
import { z } from "zod";
import type { RegistryLookup } from "../registry-types.js";
import type { Grant, GrantInput } from "../types.js";
import { decodeDelegationContext, InvalidPermissionContextError } from "./context.js";
import { parse7710DelegationChain } from "../delegation/parse-7710.js";
import type { PermissionRequestLike, PermissionResponseLike, RuleLike } from "./types.js";

const address = z.string().refine((v): v is `0x${string}` => isAddress(v), "not an address");
const hex = z.string().refine((v): v is `0x${string}` => isHex(v), "not hex");

const ruleSchema = z.object({ type: z.string(), data: z.record(z.string(), z.unknown()) });

const permissionRequestItemSchema = z.object({
  chainId: z.union([hex, z.number()]),
  from: address.optional(),
  to: address,
  permission: z.object({
    type: z.string(),
    isAdjustmentAllowed: z.boolean(),
    data: z.record(z.string(), z.unknown()),
  }),
  rules: z.array(ruleSchema).nullish(),
});

const permissionResponseItemSchema = permissionRequestItemSchema.extend({
  context: hex,
  dependencies: z.array(z.object({ factory: address, factoryData: hex })).optional(),
  delegationManager: address,
});

export class InvalidPermissionRequestError extends Error {}

function normalizeChainId(chainId: string | number): number {
  return typeof chainId === "number" ? chainId : Number.parseInt(chainId, 16);
}

function findExpiryTimestamp(rules: RuleLike[] | null | undefined): number | undefined {
  const expiryRule = rules?.find((r) => r.type === "expiry");
  const timestamp = expiryRule?.data.timestamp;
  return typeof timestamp === "number" ? timestamp : undefined;
}

export interface Parse7715Options {
  registry?: RegistryLookup;
  input: GrantInput;
  path: string;
}

/** Builds the Grant for one request item. A bare request is an unenforceable *intent* (`scope: "unknown"`) — nothing has been granted yet, so there's no caveat chain to decode. Compare with `grantFrom7715Response`. */
function grantFrom7715Request(request: PermissionRequestLike, options: Parse7715Options): Grant {
  const chainId = normalizeChainId(request.chainId);
  const expiry = findExpiryTimestamp(request.rules);

  return {
    id: `7715-request:${options.path}`,
    standard: "7715",
    grantor: request.from ?? null,
    grantee: { type: "account", address: request.to },
    chains: { type: "list", chainIds: [chainId] },
    scope: { type: "unknown" },
    validity: expiry !== undefined ? { notAfter: expiry } : {},
    replay: {},
    revocation: { method: "Not yet granted — this is a request, not a response.", onchain: false },
    facts: {
      permissionType: request.permission.type,
      isAdjustmentAllowed: request.permission.isAdjustmentAllowed,
      ruleTypes: (request.rules ?? []).map((r) => r.type),
    },
    source: { input: options.input, path: options.path },
  };
}

/** Builds the Grant for one response item, decoding `context` into its actual 7710 delegation chain (`children`) — see `context.ts`'s doc comment on why this, not the request, is what's actually enforced. */
function grantFrom7715Response(response: PermissionResponseLike, options: Parse7715Options): Grant {
  const chainId = normalizeChainId(response.chainId);
  const grant = grantFrom7715Request(response, options);
  grant.id = `7715-response:${options.path}`;
  grant.revocation = {
    method: "wallet_revokeExecutionPermission({ permissionContext }) if the wallet supports it, or disableDelegation() on the DelegationManager for the underlying delegation (on-chain, costs gas)",
    onchain: true,
  };
  grant.facts.delegationManager = response.delegationManager;

  let delegations;
  try {
    delegations = decodeDelegationContext(response.context);
  } catch (err) {
    if (err instanceof InvalidPermissionContextError) {
      grant.facts.contextDecodeFailed = true;
      grant.scope = { type: "unknown" };
      return grant;
    }
    throw err;
  }

  const domain = { name: "DelegationManager", version: "1", chainId, verifyingContract: response.delegationManager };
  const children = parse7710DelegationChain(delegations, domain, {
    registry: options.registry,
    input: options.input,
    path: `${options.path}.context`,
  });

  grant.children = children;
  grant.facts.contextDelegationCount = children.length;
  return grant;
}

export function parse7715Requests(params: unknown, options: Omit<Parse7715Options, "path">): Grant[] {
  const parsed = z.array(permissionRequestItemSchema).safeParse(params);
  if (!parsed.success) {
    throw new InvalidPermissionRequestError(`not a valid ERC-7715 permission request array: ${parsed.error.message}`);
  }
  return parsed.data.map((request, index) => grantFrom7715Request(request, { ...options, path: `[${index}]` }));
}

export function parse7715Responses(params: unknown, options: Omit<Parse7715Options, "path">): Grant[] {
  const parsed = z.array(permissionResponseItemSchema).safeParse(params);
  if (!parsed.success) {
    throw new InvalidPermissionRequestError(`not a valid ERC-7715 permission response array: ${parsed.error.message}`);
  }
  return parsed.data.map((response, index) => grantFrom7715Response(response, { ...options, path: `[${index}]` }));
}
