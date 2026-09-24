import type { Address, Hex } from "viem";

/**
 * Everything the library can be asked to decode. `rpc` is the escape hatch:
 * pass whatever a dapp handed the wallet and `detect()` routes it to a
 * specific parser (IMPLEMENTATION_PLAN.md §5.1).
 */
export type GrantInput =
  | { kind: "rpc"; method: string; params: unknown[]; chainId?: number }
  | { kind: "7702-authorization"; authorization: AuthorizationLike }
  | { kind: "7702-transaction"; serialized: Hex }
  | { kind: "typed-data"; typedData: unknown }
  | { kind: "7715-request"; params: unknown }
  | { kind: "7715-response"; params: unknown }
  | { kind: "raw-hash"; hash: Hex };

/**
 * Both viem field spellings for the 7702 delegate show up across versions
 * and clients ("address" in the EIP text, "contractAddress" in some tooling).
 * We normalize to `address` in the IR but accept either on input.
 */
export type AuthorizationLike = {
  chainId: number | bigint;
  address?: Address;
  contractAddress?: Address;
  nonce: number | bigint;
  r?: Hex;
  s?: Hex;
  yParity?: number;
  v?: bigint;
};

export type Standard = "7702" | "7710" | "7715" | "raw-hash" | "delegate-execution";

export type Grantee =
  | { type: "code"; address: Address }
  | { type: "account"; address: Address }
  | { type: "anyone" }
  | { type: "unknown" };

export type Chains = { type: "all" } | { type: "list"; chainIds: number[] };

export type Restriction =
  | { type: "targets"; addresses: Address[] }
  | { type: "methods"; selectors: Hex[] }
  | { type: "value-per-call"; maxWei: bigint }
  | { type: "native-total"; maxWei: bigint }
  | { type: "erc20-total"; token: Address; max: bigint }
  | { type: "periodic"; asset: Address | "native"; amount: bigint; periodSeconds: number }
  | { type: "stream"; asset: Address | "native"; ratePerSecond: bigint; initial?: bigint; max?: bigint }
  | { type: "calls"; max: bigint }
  | { type: "time"; after?: number; before?: number }
  | { type: "redeemers"; addresses: Address[] }
  | { type: "opaque"; enforcer: Address; name?: string; terms: Hex }
  | { type: "unrecognized"; enforcer: Address; terms: Hex };

export type Scope =
  | { type: "full-account" }
  | { type: "revoke" }
  | { type: "restricted"; restrictions: Restriction[] }
  | { type: "unknown" };

export interface Validity {
  notBefore?: number;
  notAfter?: number;
  maxUses?: bigint;
}

export interface Replay {
  nonce?: bigint;
  salt?: bigint;
}

export interface Revocation {
  method: string;
  onchain: boolean;
  notes?: string;
}

/**
 * Standard-neutral intermediate representation every parser produces and
 * every rule consumes. See IMPLEMENTATION_PLAN.md §5.2.
 */
export interface Grant {
  id: string;
  standard: Standard;
  grantor: Address | null;
  grantee: Grantee;
  chains: Chains;
  scope: Scope;
  validity: Validity;
  replay: Replay;
  revocation: Revocation;
  parent?: Grant;
  children?: Grant[];
  /** Filled in by @permissionlens/onchain enrichment (codehash, isProxy, ...). */
  facts: Record<string, unknown>;
  source: { input: GrantInput; path: string };
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "certain" | "heuristic";

export interface Finding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  grantId: string;
  docsUrl: string;
}

export interface NotChecked {
  ruleId: string;
  missingFacts: string[];
}

export interface DecodeResult {
  specVersion: "1";
  grants: Grant[];
  findings: Finding[];
  notChecked: NotChecked[];
  /** Distinct rule IDs that actually evaluated against at least one grant — used to render an honest "N checks" count, never a guessed one. */
  checkedRuleIds: string[];
  unsupported?: { reason: string };
  registryVersion: string;
}

export interface DecodeOptions {
  chainId?: number;
  registry?: import("./registry-types.js").RegistryLookup;
  registryVersion?: string;
}
