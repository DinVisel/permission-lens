import { zeroAddress } from "viem";
import type { Address } from "viem";
import { hashAuthorization, isLowS, recoverAuthority } from "../authorization.js";
import type { NormalizedAuthorization } from "../authorization.js";
import type { Grant, GrantInput } from "../types.js";

export interface From7702Options {
  /** The address that declared authority over this authorization, if known independently of recovery (e.g. `eth_sendTransaction` params usually name it). */
  declaredAuthority?: Address;
  /** True when this authorization traveled inside a transaction sent by a different account. */
  relayed?: boolean;
  path: string;
  input: GrantInput;
}

/** Builds the standard-neutral Grant IR for one EIP-7702 authorization tuple. Never throws on a malformed signature — malformed-ness becomes a fact for PL-7702-014 to flag, since a decoder's job is to report what was signed, not to reject it. */
export async function grantFrom7702Authorization(
  auth: NormalizedAuthorization,
  options: From7702Options,
): Promise<Grant> {
  const id = hashAuthorization(auth);

  const facts: Record<string, unknown> = {
    tupleNonce: auth.nonce,
  };
  if (options.relayed !== undefined) facts.relayed = options.relayed;

  let grantor: Address | null = options.declaredAuthority ?? null;

  if (auth.signature) {
    facts.lowS = isLowS(auth.signature.s);
    facts.yParity = auth.signature.yParity;
    facts.signatureMalformed = auth.signature.yParity !== 0 && auth.signature.yParity !== 1;

    try {
      const { authority, lowS } = await recoverAuthority(auth);
      facts.recoveredAuthority = authority;
      facts.lowS = lowS;
      if (options.declaredAuthority) {
        facts.recoveredMatchesDeclared = authority.toLowerCase() === options.declaredAuthority.toLowerCase();
      } else {
        grantor = authority;
      }
    } catch {
      facts.recoveryFailed = true;
    }
  }

  const isRevoke = auth.address.toLowerCase() === zeroAddress;

  const grant: Grant = {
    id,
    standard: "7702",
    grantor,
    grantee: isRevoke ? { type: "unknown" } : { type: "code", address: auth.address },
    chains: auth.chainId === 0n ? { type: "all" } : { type: "list", chainIds: [Number(auth.chainId)] },
    scope: isRevoke ? { type: "revoke" } : { type: "full-account" },
    validity: {},
    replay: { nonce: auth.nonce },
    revocation: {
      method: "Sign a new authorization to 0x0000000000000000000000000000000000000000",
      onchain: true,
    },
    facts,
    source: { input: options.input, path: options.path },
  };

  return grant;
}
