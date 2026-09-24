import { hashTypedData } from "viem";
import type { TypedDataDomain } from "viem";
import { ANY_DELEGATE, DELEGATION_TYPES, ROOT_AUTHORITY } from "./constants.js";
import { COMPOSITE_LOGIC_DECODER_IDS, enforcerDecoders } from "./enforcers.js";
import type { CaveatLike, DelegationLike } from "./types.js";
import type { RegistryLookup } from "../registry-types.js";
import type { Grant, GrantInput, Restriction } from "../types.js";

export interface From7710Options {
  domain: TypedDataDomain;
  registry?: RegistryLookup;
  chainId?: number;
  path: string;
  input: GrantInput;
}

/** The EIP-712 hash of a `Delegation` — excludes `signature`/`args`, matching exactly what's signed (LEARNING.md §7.1). Used as the Grant's stable id and to link redelegation chains by `authority`. */
export function hashDelegation(delegation: DelegationLike, domain: TypedDataDomain): `0x${string}` {
  return hashTypedData({
    domain,
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message: {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: delegation.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: BigInt(delegation.salt),
    },
  });
}

function resolveCaveat(caveat: CaveatLike, options: From7710Options): { restriction: Restriction; isCompositeLogic: boolean } {
  const entry = options.registry?.lookupAddress(caveat.enforcer, options.chainId);

  if (!entry) {
    return { restriction: { type: "unrecognized", enforcer: caveat.enforcer, terms: caveat.terms }, isCompositeLogic: false };
  }

  const isCompositeLogic = entry.decoder != null && COMPOSITE_LOGIC_DECODER_IDS.has(entry.decoder);
  const decoder = entry.decoder ? enforcerDecoders[entry.decoder] : undefined;

  if (!decoder) {
    return {
      restriction: { type: "opaque", enforcer: caveat.enforcer, name: entry.name, terms: caveat.terms },
      isCompositeLogic,
    };
  }

  try {
    return { restriction: decoder(caveat.terms), isCompositeLogic };
  } catch {
    // A recognized enforcer whose terms didn't match the expected layout —
    // still "known", just not decodable by this build. Safer than silently
    // treating it as absent.
    return {
      restriction: { type: "opaque", enforcer: caveat.enforcer, name: entry.name, terms: caveat.terms },
      isCompositeLogic,
    };
  }
}

/**
 * Builds the Grant IR for one ERC-7710 delegation. Doesn't resolve
 * `parent`/`children` itself — see `linkRedelegationChain` for that, since
 * it needs every delegation in a chain at once, not one at a time.
 */
export function grantFrom7710Delegation(delegation: DelegationLike, options: From7710Options): Grant {
  const id = hashDelegation(delegation, options.domain);

  const restrictions: Restriction[] = [];
  let hasCompositeLogicCaveat = false;
  for (const caveat of delegation.caveats) {
    const { restriction, isCompositeLogic } = resolveCaveat(caveat, options);
    restrictions.push(restriction);
    if (isCompositeLogic) hasCompositeLogicCaveat = true;
  }

  const isRootAuthority = delegation.authority.toLowerCase() === ROOT_AUTHORITY.toLowerCase();
  const isAnyDelegate = delegation.delegate.toLowerCase() === ANY_DELEGATE.toLowerCase();

  const grant: Grant = {
    id,
    standard: "7710",
    grantor: delegation.delegator,
    grantee: isAnyDelegate ? { type: "anyone" } : { type: "account", address: delegation.delegate },
    chains: options.domain.chainId !== undefined ? { type: "list", chainIds: [Number(options.domain.chainId)] } : { type: "all" },
    scope: restrictions.length === 0 ? { type: "full-account" } : { type: "restricted", restrictions },
    validity: timeValidity(restrictions),
    replay: { salt: BigInt(delegation.salt) },
    revocation: {
      method: "disableDelegation() on the DelegationManager (on-chain, costs gas)",
      onchain: true,
    },
    facts: {
      authority: delegation.authority,
      isRootAuthority,
      delegationManager: options.domain.verifyingContract,
      hasCompositeLogicCaveat,
    },
    source: { input: options.input, path: options.path },
  };

  return grant;
}

function timeValidity(restrictions: Restriction[]): Grant["validity"] {
  const time = restrictions.find((r): r is Extract<Restriction, { type: "time" }> => r.type === "time");
  if (!time) return {};
  return { notBefore: time.after, notAfter: time.before };
}

/**
 * Links `parent`/`children` across a set of delegations that were decoded
 * together (a redelegation chain — LEARNING.md §7.4): each delegation whose
 * `authority` isn't `ROOT_AUTHORITY` should match another delegation's hash
 * in the same set. When it doesn't, `facts.parentUnresolved` is set instead
 * of silently leaving the chain incomplete — PL-7710-006 treats that as
 * more severe than a resolved chain.
 */
export function linkRedelegationChain(grants: Grant[]): Grant[] {
  const byId = new Map(grants.map((g) => [g.id.toLowerCase(), g]));

  for (const grant of grants) {
    const authority = grant.facts.authority as `0x${string}` | undefined;
    if (!authority || grant.facts.isRootAuthority) continue;

    const parent = byId.get(authority.toLowerCase());
    if (parent) {
      grant.parent = parent;
      parent.children = [...(parent.children ?? []), grant];
    } else {
      grant.facts.parentUnresolved = true;
    }
  }

  return grants;
}
