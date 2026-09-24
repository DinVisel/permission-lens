import type { GrantInput, AuthorizationLike } from "./types.js";

export type ResolvedInput =
  | { kind: "7702-authorization"; authorization: AuthorizationLike }
  | { kind: "7702-transaction"; serialized: `0x${string}` }
  | { kind: "raw-hash"; hash: `0x${string}` }
  | { kind: "unsupported"; reason: string };

/**
 * Routes an RPC-shaped request to a specific parser kind
 * (IMPLEMENTATION_PLAN.md §5.1). Non-`rpc` inputs pass through unchanged.
 * Anything not recognized becomes an explicit `unsupported` result — never a
 * silent no-op (§8 rule 5 / PL-GEN-003).
 */
export function detect(input: GrantInput): ResolvedInput[] {
  if (input.kind !== "rpc") {
    if (input.kind === "7702-authorization") return [{ kind: "7702-authorization", authorization: input.authorization }];
    if (input.kind === "7702-transaction") return [{ kind: "7702-transaction", serialized: input.serialized }];
    if (input.kind === "raw-hash") return [{ kind: "raw-hash", hash: input.hash }];
    if (input.kind === "onchain-observation") {
      return [{ kind: "unsupported", reason: "onchain-observation requires a live chain read — use @permissionlens/onchain's checkAddressDelegation(), not decode()" }];
    }
    return [{ kind: "unsupported", reason: `${input.kind} is not yet supported by this build of @permissionlens/core` }];
  }

  const { method, params } = input;

  if ((method === "eth_sendTransaction" || method === "eth_signTransaction") && Array.isArray(params)) {
    const tx = params[0] as { authorizationList?: AuthorizationLike[] } | undefined;
    if (tx?.authorizationList && tx.authorizationList.length > 0) {
      return tx.authorizationList.map((authorization) => ({ kind: "7702-authorization" as const, authorization }));
    }
    return [{ kind: "unsupported", reason: `${method} without an authorizationList is an ordinary transaction, not a grant` }];
  }

  if (method === "eth_sendRawTransaction" && typeof params[0] === "string") {
    const serialized = params[0] as `0x${string}`;
    if (serialized.startsWith("0x04")) {
      return [{ kind: "7702-transaction", serialized }];
    }
    return [{ kind: "unsupported", reason: "eth_sendRawTransaction payload is not a type-0x04 transaction" }];
  }

  if (method === "eth_sign" && typeof params[1] === "string") {
    return [{ kind: "raw-hash", hash: params[1] as `0x${string}` }];
  }

  return [{ kind: "unsupported", reason: `RPC method "${method}" is not yet supported by this build of @permissionlens/core` }];
}
