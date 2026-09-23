# PermissionLens — Implementation Plan

> **One-line pitch:** an open-source, offline-first decoder that tells a user
> *what authority a signature grants* — for EIP-7702 authorizations, ERC-7710
> delegations and ERC-7715 permission requests — with evidence-backed risk
> flags that wallets, explorers and security tools can embed.
>
> **Working name:** PermissionLens (`permissionlens` and `@permissionlens/*`
> are free on npm as of 2026-09-23; a few small unrelated GitHub repos use the
> name — confirm the final name in Phase 0).
>
> **Background reading:** [`LEARNING.md`](LEARNING.md). Section references like
> "L§5.2" point there.

---

## Table of contents

1. [Goals, non-goals, success metrics](#1-goals-non-goals-success-metrics)
2. [Positioning](#2-positioning)
3. [Users and distribution](#3-users-and-distribution)
4. [Architecture](#4-architecture)
5. [Core data model](#5-core-data-model)
6. [Rule catalogue](#6-rule-catalogue)
7. [The registry](#7-the-registry)
8. [Output and UX rules](#8-output-and-ux-rules)
9. [Phased roadmap](#9-phased-roadmap)
10. [Testing strategy](#10-testing-strategy)
11. [Securing the project itself](#11-securing-the-project-itself)
12. [Launch, adoption, funding](#12-launch-adoption-funding)
13. [Risks and mitigations](#13-risks-and-mitigations)
14. [Decisions to make in Phase 0](#14-decisions-to-make-in-phase-0)
15. [First 15 issues](#15-first-15-issues)

---

## 1. Goals, non-goals, success metrics

### Goals
1. **Decode every grant-type signature** a wallet can see today into a
   standard-neutral model: who → to whom → where → what scope → how long →
   how to revoke.
2. **Flag risk with evidence**, never with an unexplained score.
3. **Run anywhere:** the core must work offline, with no network access, in a
   browser, Node, a wallet extension, or a Snap.
4. **Be a public good:** permissively licensed code, CC0 registry data, open
   review process.
5. **Get embedded.** Success is other products using it, not traffic to our
   website.

### Non-goals (v1)
- Transaction **simulation** (complement Blockaid/Tenderly; don't rebuild them).
- Rendering ordinary contract calls (reuse ERC-7730 descriptors instead).
- Recovering compromised accounts.
- Hardware wallet firmware (the registry format and rule spec stay
  language-neutral so ports are possible later).
- Native AA (EIP-8141 / EIP-8130) until those specs stabilize. The data model
  is designed for them (Phase 6).

### Success metrics
| Horizon | Metric | Target |
|---|---|---|
| Phase 0 (week 2) | Teams who say "we'd evaluate this" | ≥ 2 wallet/explorer/security teams, or explicit fit from the Clear Signing WG |
| Launch (≈ week 20) | Grant types decoded | 7702 auth, 7702 tx, 7710 delegation, 7715 request/response, raw hash, delegate typed-data |
| Launch | Registry entries | ≥ 20 recognized implementations/enforcers with evidence; ≥ 10 malicious code clusters |
| 6 months post-launch | Integrations | ≥ 1 shipped in a wallet or explorer; ≥ 2 in progress |
| 6 months | Standards | Descriptor-extension draft posted and discussed on Ethereum Magicians |
| 6 months | Funding | ≥ 1 grant awarded (Gitcoin GG, Optimism Retro Funding, ESP open round, or vendor grant) |

---

## 2. Positioning

| | Commercial simulators (Blockaid, GoPlus, …) | ERC-7730 Clear Signing | **PermissionLens** |
|---|---|---|---|
| Question answered | "What happens if I send this now?" | "What does this call do?" | "What authority am I granting, to whom, for how long?" |
| Covers 7702 auth / 7715 / 7710 | Partially, proprietary | **No** (spec excludes them) | **Yes — the focus** |
| Works offline / embeddable | No (API) | Yes (data) | Yes (library + data) |
| Open data | No | Yes | Yes |

**Why grants need their own analysis:** signing a grant moves nothing, so
simulation shows no effect. Damage happens later. Grants need *scope
analysis*, which is static (L§11).

**Why an open project:** wallets reinvent this inconsistently; small wallets,
explorers and hardware vendors can't license a commercial API for every
signature; the Clear Signing effort shows the ecosystem wants shared, reviewed
data.

---

## 3. Users and distribution

| User | What they need | Surface |
|---|---|---|
| Wallet teams (Rabby, Ambire, Frame, Rainbow, embedded-wallet SDKs) | Drop-in decode + risk list for signing screens | `@permissionlens/core` + registry |
| Block explorers (Blockscout is open source) | Label 7702-delegated accounts with the delegate's identity and risk | `@permissionlens/registry` + `onchain` |
| Security tools / researchers | Batch-analyse delegates; data on malicious clusters | CLI, census tool, open dataset |
| End users | "What did I sign?" / "Is my address delegated, and to what?" | Web app, MetaMask Snap |
| Protocol and wallet vendors | Get their delegate implementation recognized | Registry PR process |

---

## 4. Architecture

### 4.1 Data flow

```
             ┌──────────────────────────── @permissionlens/core (offline, pure) ───────────────────────────┐
 input  ───► │ detect() ─► parser (7702 | 7710 | 7715 | typed-data | raw-hash) ─► Grant[] (IR) ─► rules ─► │
 (RPC req,   │                                   ▲                                           │           │
  tx, JSON)  │                           registry lookup (bundled data)                     ▼           │
             │                                                                  DecodeResult ─► render() │
             └───────────────────────────────────────────────────────────────────────────────────┬──────┘
                                                                                                 │
                    optional  ┌──── @permissionlens/onchain ────┐                               ▼
                    ────────► │ enrich(result, publicClient):   │ ─► extra facts ─► re-run rules ─► text / markdown / JSON
                              │ code, codehash, proxy, nonce,   │
                              │ verification, cross-chain code  │
                              └─────────────────────────────────┘
```

Two-stage design: **decode offline**, then **optionally enrich** with chain
data. Rules declare which facts they need; a rule whose facts are missing
reports "not checked" instead of silently passing.

### 4.2 Repository layout (pnpm workspaces)

```
permission-lens/
├── packages/
│   ├── core/          # parsers, IR, rules, renderers. Deps: viem only. No network.
│   ├── registry/      # data/**/*.json, JSON Schema, loader, codehash utils
│   ├── onchain/       # enrichment using a viem PublicClient (user-supplied RPC)
│   └── cli/           # `permissionlens decode|address|census`
├── apps/
│   ├── web/           # Next.js: paste a request, or check an address
│   └── snap/          # MetaMask Snap: signature + transaction insights
├── contracts/         # Foundry: delegate fixtures, sweeper sample, proxy sample, tests
├── fixtures/          # golden inputs + expected outputs (shared by all packages)
├── tools/census/      # scripts to enumerate on-chain delegations and cluster code
├── docs/              # rule docs (one page per rule ID), integration guides
├── .github/workflows/ # CI: lint, typecheck, test, forge test, registry validation
├── LICENSE-MIT, LICENSE-APACHE (code) · registry/LICENSE (CC0-1.0)
└── SECURITY.md, CONTRIBUTING.md, GOVERNANCE.md
```

### 4.3 Tech choices

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Wallet ecosystem is TS-first; you know it |
| Chain primitives | `viem` as a **peer dependency** | Verified: `hashAuthorization`, `recoverAuthorizationAddress`, `verifyAuthorization`, `parseTransaction` exist in viem 2.56.8 |
| Input validation | `zod` (or valibot for size) | Untrusted input from dapps |
| Build | `tsup` → ESM + CJS + `.d.ts` | Same as your SDK |
| Tests | `vitest`, `fast-check`, Foundry | Unit, property and chain-level tests |
| Web | Next.js | You already built the playground in it |
| Monorepo | pnpm workspaces + changesets | Independent package versions |

**Hard rule:** `packages/core` must not import `fetch`, Node built-ins or any
network library. Enforce it with an ESLint `no-restricted-imports` rule and a
CI check on the bundle.

---

## 5. Core data model

### 5.1 Inputs

```ts
export type GrantInput =
  | { kind: "rpc"; method: string; params: unknown[]; chainId?: number } // pass what the wallet received
  | { kind: "7702-authorization"; authorization: AuthorizationLike }      // unsigned or signed tuple
  | { kind: "7702-transaction"; serialized: Hex }                          // raw type-4 tx
  | { kind: "typed-data"; typedData: TypedDataDefinition }
  | { kind: "7715-request"; params: unknown }
  | { kind: "7715-response"; params: unknown }
  | { kind: "raw-hash"; hash: Hex };

// Accept both viem field spellings seen across versions.
export type AuthorizationLike = {
  chainId: number | bigint;
  address?: Address;
  contractAddress?: Address;
  nonce: number | bigint;
  r?: Hex; s?: Hex; yParity?: number; v?: bigint;
};
```

`detect(input)` maps `rpc` inputs onto the specific kinds:

| RPC method | Routed to |
|---|---|
| `eth_sendTransaction` / `eth_signTransaction` with `authorizationList` | 7702 parser (each tuple) |
| `eth_sendRawTransaction` with type `0x04` | 7702 transaction parser |
| `eth_signTypedData_v4` with domain `name = "DelegationManager"` | 7710 parser |
| `eth_signTypedData_v4` whose `verifyingContract` is a registry-known delegate | delegate-execution parser |
| `eth_sign` | raw-hash parser |
| `wallet_requestExecutionPermissions` (+ legacy `wallet_grantPermissions`) | 7715 request parser |
| anything else | `unsupported` result (never silent) |

### 5.2 The Grant IR

```ts
export interface Grant {
  id: string;                                   // stable hash of the source
  standard: "7702" | "7710" | "7715" | "raw-hash" | "delegate-execution";
  grantor: Address | null;                      // recovered or declared; null if unknown
  grantee:
    | { type: "code"; address: Address }        // 7702 delegate contract
    | { type: "account"; address: Address }     // 7710 delegate / 7715 `to`
    | { type: "anyone" }                        // ANY_DELEGATE
    | { type: "unknown" };
  chains: { type: "all" } | { type: "list"; chainIds: number[] };
  scope:
    | { type: "full-account" }
    | { type: "revoke" }                        // 7702 to 0x0
    | { type: "restricted"; restrictions: Restriction[] }
    | { type: "unknown" };
  validity: { notBefore?: number; notAfter?: number; maxUses?: bigint };
  replay: { nonce?: bigint; salt?: bigint };
  revocation: { method: string; onchain: boolean; notes?: string };
  parent?: Grant;                               // redelegation chain (7710)
  children?: Grant[];                           // 7715 response context → 7710 delegations
  facts: Record<string, unknown>;               // filled by enrichment (codehash, isProxy, …)
  source: { input: GrantInput; path: string };  // where in the input this came from
}

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
  | { type: "opaque"; enforcer: Address; name?: string; terms: Hex } // known enforcer, no decoder yet
  | { type: "unrecognized"; enforcer: Address; terms: Hex };        // treated as absent by rules
```

### 5.3 Findings and results

```ts
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  ruleId: string;                  // e.g. "PL-7702-001"
  severity: Severity;
  confidence: "certain" | "heuristic";
  title: string;                   // short, plain language
  detail: string;                  // one or two sentences, no jargon
  evidence: Record<string, unknown>;
  grantId: string;
  docsUrl: string;                 // docs/rules/PL-7702-001.md
}

export interface DecodeResult {
  specVersion: "1";
  grants: Grant[];
  findings: Finding[];
  notChecked: { ruleId: string; missingFacts: string[] }[]; // honest about gaps
  unsupported?: { reason: string };
  registryVersion: string;
}
```

### 5.4 Public API

```ts
import { decode, render } from "@permissionlens/core";
import { enrich } from "@permissionlens/onchain";

const result = decode(input, { chainId: 1 });                  // sync, offline
const enriched = await enrich(result, { client: publicClient }); // optional
const text = render(enriched, { format: "text" | "markdown" | "json" });
```

---

## 6. Rule catalogue

Each rule is a pure function `(grant, ctx) => Finding | null`, declares
`requiredFacts`, and has a doc page. IDs are permanent: never renumber, only
deprecate.

### 6.1 EIP-7702

| ID | Condition | Severity | Needs chain data |
|---|---|---|---|
| PL-7702-001 | `chain_id == 0` (valid on all chains) | high (critical if the delegate is unrecognized) | no |
| PL-7702-002 | Delegate matches a registry entry with `status: malicious` (address or codehash) | critical | no (address) / yes (codehash) |
| PL-7702-003 | Delegate not recognized by the registry | high | no |
| PL-7702-004 | Delegate recognized (`status: recognized`) | info (show name, vendor, audits) | no |
| PL-7702-005 | Delegate is `0x0` → revokes the current delegation | info | no |
| PL-7702-006 | No code at the delegate on the target chain | high ("code could be deployed there later") | yes |
| PL-7702-007 | Delegate is a proxy (EIP-1967 / EIP-1167 / beacon) | medium (show the admin/owner) | yes |
| PL-7702-008 | Delegate source not verified (Sourcify or explorer) | medium | yes |
| PL-7702-009 | Tuple nonce > current nonce + 1 ("pre-signed for later use") | medium | yes |
| PL-7702-010 | Tuple nonce < current nonce (already unusable) | info | yes |
| PL-7702-011 | Sweeper heuristic matches the delegate bytecode | critical, `confidence: heuristic` | yes |
| PL-7702-012 | `chain_id == 0` and delegate code differs, or is missing, across checked chains | high | yes (multi-RPC) |
| PL-7702-013 | Authorization is inside a tx sent by a different account (relayed) | info | no |
| PL-7702-014 | Malformed signature (high-s, bad `yParity`, recovery ≠ declared authority) | medium | no |
| PL-7702-015 | Registry says the delegate has unprotected initialization or non-namespaced storage | medium | no |

### 6.2 ERC-7710 (MetaMask Delegation Framework)

| ID | Condition | Severity |
|---|---|---|
| PL-7710-001 | No caveats → unrestricted authority over the delegator | critical |
| PL-7710-002 | `delegate == ANY_DELEGATE (0x…a11)` → a bearer grant anyone can redeem | high |
| PL-7710-003 | No time bound (no `TimestampEnforcer`/`BlockNumberEnforcer`, or `before == 0`) | medium (high if combined with PL-7710-005) |
| PL-7710-004 | Caveat enforcer address not in the registry → treated as absent | high |
| PL-7710-005 | No value or amount limit and no target restriction | high |
| PL-7710-006 | Redelegation (`authority != ROOT_AUTHORITY`); show the chain | info (medium if the parent is missing) |
| PL-7710-007 | `LogicalOrWrapperEnforcer` or other composite logic present | medium ("complex conditions") |
| PL-7710-008 | EIP-712 `verifyingContract` is not a known DelegationManager deployment | high |
| PL-7710-009 | Already expired, or expiry more than 1 year away | info / medium |

### 6.3 ERC-7715

| ID | Condition | Severity |
|---|---|---|
| PL-7715-001 | Unknown permission `type` | high |
| PL-7715-002 | No expiry rule | high |
| PL-7715-003 | Response `context` decodes to delegations that **don't match** the request (wider scope, missing limits) | critical |
| PL-7715-004 | `isAdjustmentAllowed: false` (the user cannot tighten it) | info |
| PL-7715-005 | `delegationManager` in the response isn't a known deployment | high |

### 6.4 Generic

| ID | Condition | Severity |
|---|---|---|
| PL-GEN-001 | Raw hash signing (`eth_sign`): "Could be anything, including full account takeover" | critical |
| PL-GEN-002 | Typed data addressed to a known delegate implementation that authorizes execution; list the decoded calls | high |
| PL-GEN-003 | Input not supported (explicit result, never an empty "all clear") | info |

---

## 7. The registry

### 7.1 Entry schema (JSON; validated with JSON Schema in CI)

```jsonc
{
  "schemaVersion": 1,
  "kind": "delegate-implementation",   // | "caveat-enforcer" | "delegation-manager"
  "name": "Example Stateless Delegator",
  "vendor": "Example Wallet",
  "version": "1.3.0",
  "status": "recognized",              // | "caution" | "malicious"
  "match": {
    "deployments": [{ "chainId": 1, "address": "0x…" }],
    "codehash": "0x…",                 // keccak256(runtime code)
    "normalizedCodehash": "0x…"        // metadata stripped + PUSH20 constants masked
  },
  "properties": {
    "upgradeable": false,
    "initialization": "none",          // none | signed | unprotected
    "storage": "erc7201",              // erc7201 | plain | none
    "acceptsTypedDataExecution": true
  },
  "decoder": null,                     // for enforcers: "metamask/timestamp@1" etc.
  "evidence": [
    { "type": "source", "url": "https://…" },
    { "type": "audit", "url": "https://…" }
  ],
  "review": { "submittedBy": "github-handle", "reviewers": ["…", "…"], "date": "2026-10-01" }
}
```

### 7.2 Matching order
1. Exact `(chainId, address)` deployment.
2. Exact `codehash` (same code redeployed elsewhere).
3. `normalizedCodehash`: catches copy-pasted sweepers that differ only in the
   collector address. **This can only ever produce `caution` or `malicious`,
   never `recognized`**, because a clone of legitimate code at an unknown
   address is not the vendor's deployment.

### 7.3 Governance (GOVERNANCE.md)
- **recognized:** needs vendor-controlled evidence (official repo or docs
  listing the address) plus 2 maintainer approvals. CI fetches the code on
  every listed chain and checks the codehash.
- **malicious:** needs on-chain evidence (transaction hashes showing theft or
  sweeping) plus 1 maintainer approval. Include the heuristic output.
- **caution:** anything legitimate but risky (upgradeable by a single EOA,
  unprotected init).
- **Disputes:** vendors can contest in an issue; entries carry history in git.
- Releases are versioned (`registryVersion`), published to npm with provenance,
  and also as a signed JSON bundle so non-JS consumers can verify integrity.

### 7.4 Seeding the registry
- **Recognized:** collect official 7702 delegate and enforcer deployments from
  vendor repos and docs. Candidates: MetaMask (delegation framework: stateless
  delegator, DelegationManager, enforcers), Coinbase, Safe, Ambire, OKX,
  Uniswap, Alchemy, Biconomy, ZeroDev, eth-infinitism's `Simple7702Account`.
  **Copy addresses only from the vendor's own sources, never from third-party
  lists.**
- **Malicious:** `tools/census` enumerates type-4 transactions (via RPC or a
  Dune export), groups delegates by `normalizedCodehash`, and ranks clusters by
  count. Review the top clusters by hand. Cross-reference public research
  datasets (the EIP-7702 phishing paper, public Dune dashboards).
- Publish the census summary as an open dataset. It is useful on its own and
  good for visibility.

---

## 8. Output and UX rules

These rules are part of the product; test them.

1. **Never say "safe."** The best verdict is "No issues found by N checks (M not
   run)." A dedicated test greps renderer output for "safe" or "secure".
2. **Lead with the consequence, not the standard.** Say "Lets code at 0x12…ab
   control your whole account on every chain," not "EIP-7702 auth, chainId 0."
3. **Every finding has evidence and a docs link.**
4. **Always show how to undo it.** For 7702: "sign a new authorization to
   0x000…000 in your wallet." For 7710: "`disableDelegation` on-chain (costs
   gas)."
5. **Unknown means unknown.** An unrecognized enforcer or delegate is never
   rendered as a limit or as trusted.
6. **Degrade visibly.** If enrichment didn't run, list which checks were
   skipped.

Example text render:

```
HIGH RISK — Account control permission

You are allowing the code at 0x1234…abcd to act as your account 0xA11c…e000.
  Where:    ALL chains (chain_id = 0)                          [PL-7702-001 · high]
  Who:      Unrecognized contract, source not verified         [PL-7702-003 · high] [PL-7702-008 · medium]
  Lasts:    Until you replace it
  Undo:     In your wallet, sign a new authorization to 0x0000…0000

Checks not run: PL-7702-012 (needs RPCs for other chains)
```

---

## 9. Phased roadmap

Estimates assume about 15 hours a week, solo. Each phase ends in something
shippable and has an exit check.

### Phase 0 — Validate and set up (weeks 1–2)

**Tasks**
- [ ] Post on Ethereum Magicians (Wallets / ERCs category): problem, IR sketch,
      rule list, and a request for feedback.
- [ ] Contact the Clear Signing working group (clearsigning.org). Ask whether
      7702/7715/7710 descriptors would fit alongside ERC-7730, and where.
- [ ] Message 5 potential integrators: Rabby, Ambire, Frame, Blockscout, one
      embedded-wallet SDK. Ask: *"If this existed as an MIT library plus CC0
      data, what would stop you from using it?"*
- [ ] Confirm the name; create the GitHub org and npm scope; add
      LICENSE-MIT/APACHE, CC0 for data, SECURITY.md, CONTRIBUTING.md.
- [ ] Scaffold the monorepo: pnpm, tsup, vitest, eslint (including the network
      ban in `core`), changesets, and CI running `forge test`.

**Exit check:** ≥ 2 external parties want to evaluate it, **or** the Clear
Signing WG confirms fit. If neither, pivot to the Clear Signing coverage idea
(generating ERC-7730 descriptors) and reuse the parsing work there.

### Phase 1 — 7702 core (weeks 3–5)

**Tasks**
- [ ] `parseAuthorization`: normalize `address`/`contractAddress`, recover the
      authority, validate low-s and `yParity`.
- [ ] `parse7702Transaction`: `parseTransaction` → one grant per tuple, sender
      as context.
- [ ] Grant IR, `Finding`, rule runner with `requiredFacts`, `notChecked`.
- [ ] Rules PL-7702-001/003/004/005/013/014 and PL-GEN-001/003.
- [ ] Minimal registry loader with a hand-written stub dataset.
- [ ] `render()` for text and JSON; the "never say safe" test.
- [ ] CLI: `permissionlens decode <file|json>`.
- [ ] Foundry fixtures: generate signed delegations with `vm.signDelegation`
      (including cross-chain) and export them as JSON fixtures.

**Acceptance**
- Digest and recovery match viem for 1,000 property-generated tuples,
  including `nonce = 0` and `chainId = 0` (L§12 Lab 6).
- Golden tests cover every rule, positive and negative.
- The core bundle has no network imports (CI check).

### Phase 2 — Registry v0 and on-chain enrichment (weeks 6–8)

**Tasks**
- [ ] Registry JSON Schema, loader, and matching order (§7.2).
- [ ] `codehash` and `normalizedCodehash`: strip the CBOR metadata trailer,
      mask PUSH20 operands.
- [ ] `@permissionlens/onchain` `enrich()`: `getCode`, the delegation
      indicator, EIP-1967/1167 proxy detection, `getTransactionCount`, and an
      optional Sourcify verification lookup.
- [ ] Rules PL-7702-002/006/007/008/009/010/011/012/015.
- [ ] Sweeper heuristic plus fixtures (the local sweeper from L§12 Lab 3, a
      benign delegate, and a proxy delegate) with anvil integration tests.
- [ ] `tools/census` v0: enumerate delegations for a block range, cluster, and
      write CSV output.
- [ ] Seed ≥ 10 recognized entries from vendor sources; review the top census
      clusters for malicious entries.
- [ ] CI job verifying codehashes of registry entries against public RPCs
      (nightly, non-blocking).

**Acceptance**
- `permissionlens address <addr> --rpc <url>` reports "delegated to X
  (recognized/unknown/malicious), how to revoke."
- An anvil test: delegate an EOA to the sweeper fixture and PL-7702-011 fires;
  to the benign fixture and it doesn't.

### Phase 3 — ERC-7710 and ERC-7715 (weeks 9–12)

**Tasks**
- [ ] 7710 typed-data parser: validate the domain (`DelegationManager`,
      version `"1"`), decode `Delegation` and `Caveat[]`; exclude `signature`
      and `args` from anything presented as "signed".
- [ ] Enforcer decoders (terms layouts in L§7.3): Timestamp, AllowedTargets,
      AllowedMethods, ValueLte, NativeTokenTransferAmount,
      ERC20TransferAmount, LimitedCalls, Redeemer; then periodic and streaming
      enforcers. Each decoder is versioned and keyed by registry entry.
- [ ] Registry entries for DelegationManager and enforcer deployments (from
      MetaMask's official deployment list only).
- [ ] Rules PL-7710-001…009.
- [ ] Redelegation: accept a chain of delegations; render the accumulated scope.
- [ ] 7715 request parser with **versioned adapters** (the spec is a draft;
      pin the revision in each adapter) and response parser (`context` →
      7710 delegations when the manager is known).
- [ ] Rules PL-7715-001…005, especially the request↔context cross-check.
- [ ] PL-GEN-002: typed-data execution intents for recognized delegates that
      accept them. Render inner calls with ERC-7730 descriptors when available,
      otherwise as selector + raw arguments.

**Acceptance**
- Fixtures produced by the real MetaMask delegation framework tests (L§12
  Lab 5) decode correctly.
- A mismatched 7715 response (limit removed in `context`) fires PL-7715-003.

### Phase 4 — Surfaces (weeks 13–16)

**Tasks**
- [ ] **Web app** (Next.js): "Paste a request" and "Check an address" tabs; the
      renderer shared with the CLI; runs decoding client-side.
      - Detect and **refuse private keys and seed phrases** pasted by mistake
        (64-hex strings, 12/24-word BIP-39 phrases) with a clear warning.
      - Strict CSP; no analytics on pasted content.
- [ ] **MetaMask Snap**: signature insights for typed data (7710 delegations,
      delegate execution intents) and transaction insights. Scope to what Snaps
      can actually see; document the limits honestly.
- [ ] Integration guide: "Add PermissionLens to your wallet's signing screen in
      30 lines," with examples for an extension wallet and a React embedded
      wallet.
- [ ] Docs site: one page per rule ID.

**Acceptance**
- The web app works offline after first load for paste-decoding.
- The Snap passes the MetaMask Snaps review checklist locally.

### Phase 5 — Launch and first integrations (weeks 17–20)

**Tasks**
- [ ] Publish v0.1 of all packages with npm provenance; tag registry v1.
- [ ] Launch post: problem, demo, census findings (the dataset gets attention),
      and a call for registry contributors.
- [ ] Open integration PRs, or issues with a working prototype, for at least 2
      open-source consumers (candidates: Rabby, Frame, Blockscout's 7702
      account view).
- [ ] Apply for grants (§12).
- [ ] Office hours or an issue template for vendors adding their deployments.

**Exit check:** at least one external integration in progress, and at least 3
external registry PRs.

### Phase 6 — Standards and expansion (ongoing)

- [ ] **Descriptor extension for grants:** draft a proposal (ERC-7730
      extension or companion ERC) describing delegate implementations and
      enforcers in a wallet-consumable format. Post on Magicians and bring it to
      the Clear Signing WG.
- [ ] ERC-7579 Smart Sessions and 4337 session-key module parsers.
- [ ] EIP-8141 (frame transactions) and EIP-8130 (keystore) parsers once specs
      stabilize. The IR already models "grants"; these become new parsers.
- [ ] Localization (strings live in a message catalog from day one).
- [ ] A rule-spec document so the rules can be ported to Rust or C for hardware
      wallets.

---

## 10. Testing strategy

| Layer | What | Tooling |
|---|---|---|
| Unit | Each parser, enforcer decoder and rule, positive and negative | vitest |
| Golden | `fixtures/<case>/input.json` → `expected.json` (findings, grants); shared by core, CLI and web | vitest snapshot (reviewed diffs only) |
| Cross-implementation | Digest and recovery vs viem; signatures generated by Foundry `vm.signDelegation` and by `cast wallet sign-auth` | vitest + forge |
| Property | Random tuples, typed data and caveat lists: never throws; unknown delegate or enforcer **never** yields zero high+ findings | fast-check |
| Fuzz / adversarial | Malformed RLP, oversized arrays, wrong types, prototype-pollution keys in JSON | fast-check + zod |
| Chain integration | anvil `--hardfork prague`: delegate to fixtures, run `enrich()` | forge + vitest |
| Registry | Schema validation on PR; codehash verification nightly | CI |
| UX invariants | No "safe"/"secure" wording; every finding has a docs page; every rule ID documented | vitest |
| Real-world corpus | Payloads collected from public incident reports (anonymized) | golden tests |

Coverage target: 90% lines in `core`, 100% of rule IDs with positive and
negative fixtures.

---

## 11. Securing the project itself

A security tool that gets compromised or gives false comfort does harm. Treat
these as requirements:

- **Supply chain:** minimal dependencies in `core`; lockfile; publish with
  `npm publish --provenance` from CI only; 2FA on npm and GitHub; protected
  branches; signed tags.
- **Registry poisoning:** the governance in §7.3; `recognized` can never come
  from heuristics; every entry change shows up in a human-readable diff in the
  PR.
- **False comfort:** UX rules in §8; README and output state that the tool is
  informational and not a guarantee.
- **User data:** the web app decodes client-side; it never needs private data
  and refuses keys and seed phrases; there is no logging of pasted content.
- **Responsible disclosure:** SECURITY.md with a contact address and a
  response-time target.
- **Lessons from SessionKit:** your old `SessionValidator` let anyone overwrite
  anyone's session, the same class of bug as "unprotected initialization."
  Encode it as a fixture for PL-7702-015 so the lesson becomes a test.

---

## 12. Launch, adoption, funding

**Adoption path:** Magicians post → WG conversation → integrator interviews →
census dataset launch → integration PRs → descriptor-extension proposal.

**Funding options:**
- Gitcoin Grants (the GG24 structure includes an OSS tooling track), Optimism
  Retro Funding (developer tooling), and ESP open applications. The ESP
  wishlist has no active items right now, but the ESP says it favors "a clear
  path to adoption, usability testing, and real integration," which the Phase 0
  and 5 exit checks give you evidence for.
- Vendor grants from wallets or chains that benefit, such as smart-account
  vendors who want their implementations recognized.

**What to show grant reviewers:** census numbers, integrations, registry
contributors, rule coverage, and the explicit ERC-7730 gap.

---

## 13. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| A big wallet builds this in-house | Medium | Be the shared data layer (registry) they'd rather consume than maintain; engage early in Phase 0 |
| Spec churn (7715 draft; 8141 vs 8130) | High | Versioned adapters; standard-neutral IR; pin spec revisions in tests |
| False negatives create false confidence | Medium | "Never say safe"; `notChecked` list; unknown = risky |
| False positives annoy integrators | Medium | Heuristic findings labeled; severity tuning with integrator feedback |
| Registry poisoning or vendor disputes | Low–Medium | Evidence rules, 2-reviewer approval, git history, dispute process |
| Solo-maintainer burnout | Medium | Narrow scope per phase; recruit registry reviewers early; funding |
| Few 7702 phishing cases visible to dapps (wallets limit authorization requests) | Medium | Address mode, explorer labeling and 7710/7715 carry value even when auth phishing is rare |

---

## 14. Decisions to make in Phase 0

1. **Final name** (check GitHub, npm, and domain).
2. **License:** MIT/Apache-2.0 dual for code and CC0 for data (recommended),
   or MIT only.
3. **Which chains ship in registry v1:** recommend Ethereum mainnet, Base,
   Optimism, Arbitrum and Sepolia.
4. **7715 revision to pin first:** whatever MetaMask ships in production at
   that time.
5. **Hosting for the web app:** static (Vercel or GitHub Pages) so decoding
   stays client-side.
6. **Whether to accept `caution` entries at launch** or only `recognized` and
   `malicious`.

---

## 15. First 15 issues

1. Scaffold the pnpm monorepo (core, registry, onchain, cli) with tsup,
   vitest, eslint and changesets.
2. CI: lint, typecheck, test, `forge test`, and a bundle check (no network in
   core).
3. Define the `Grant`, `Restriction`, `Finding` and `DecodeResult` types, with
   docs.
4. `parseAuthorization` with `address`/`contractAddress` normalization and
   authority recovery.
5. Property test: manual digest == `hashAuthorization` (includes the zero-RLP
   case).
6. `parse7702Transaction` from a serialized type-4 tx.
7. Rule runner with `requiredFacts` and `notChecked`.
8. Rules PL-7702-001, -003, -004, -005.
9. Rule PL-GEN-001 (raw hash) and PL-GEN-003 (unsupported).
10. Text/JSON renderer plus the "never say safe" invariant test.
11. Foundry project in `contracts/`: benign delegate, sweeper pattern, EIP-1967
    proxy delegate.
12. Fixture generator script: `vm.signDelegation` → `fixtures/*.json`.
13. CLI `decode` command.
14. Registry JSON Schema plus loader plus 3 stub entries.
15. Draft the Ethereum Magicians post from §1–§6 of this plan.
