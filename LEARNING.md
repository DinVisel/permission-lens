# PermissionLens — Learning Guide

> **What this is:** everything you need to understand before (and while) building
> PermissionLens, an open-source decoder that turns *permission and delegation
> signatures* — EIP-7702 authorizations, ERC-7710 delegations, ERC-7715
> permission requests — into plain language with risk flags.
>
> **How to use it:** read Parts 1–3 straight through (foundations). Parts 4–8
> are the three standards you will decode plus the ecosystem around them —
> read them alongside the matching implementation phase. Part 10 contains
> hands-on labs; do each lab before building the matching feature.
>
> **Companion file:** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
>
> Facts in this guide were checked against the EIP texts, the MetaMask
> `delegation-framework` source, viem 2.56.8 and Foundry 1.8.3 in September
> 2026. ERC-7715 and ERC-7730 are still **Draft** — always re-check the spec
> revision you are coding against.

---

## Table of contents

1. [The problem, in one page](#part-1--the-problem-in-one-page)
2. [Foundations: keys, signatures, replay protection](#part-2--foundations-keys-signatures-replay-protection)
3. [Everything a wallet can be asked to sign](#part-3--everything-a-wallet-can-be-asked-to-sign)
4. [Account abstraction landscape](#part-4--account-abstraction-landscape)
5. [EIP-7702 in depth](#part-5--eip-7702-in-depth)
6. [How 7702 gets abused](#part-6--how-7702-gets-abused)
7. [ERC-7710 delegations (MetaMask Delegation Framework)](#part-7--erc-7710-delegations)
8. [ERC-7715 permission requests](#part-8--erc-7715-permission-requests)
9. [Clear Signing and ERC-7730 — where we fit](#part-9--clear-signing-and-erc-7730)
10. [Bytecode literacy for delegate analysis](#part-10--bytecode-literacy)
11. [Static decoding vs. simulation](#part-11--static-decoding-vs-simulation)
12. [Hands-on labs](#part-12--hands-on-labs)
13. [Glossary](#part-13--glossary)
14. [Reading list](#part-14--reading-list)

---

## Part 1 — The problem, in one page

Ethereum wallets used to ask users to sign two kinds of things: **transactions**
(move this ETH, call this contract) and **messages** (log in, sign a permit).
Both could be dangerous, but a transaction at least had a visible destination
and value.

Since the Pectra upgrade (May 2025) and the rise of smart accounts, wallets
also ask users to sign **grants of authority**:

| Signature | What it really means |
|---|---|
| EIP-7702 authorization | "Let the code at address X run *as my account*, on this chain (or on **every** chain), until I replace it." |
| ERC-7710 delegation | "Let address Y act for my smart account, within these caveats." |
| ERC-7715 permission request | "Dapp asks: may I get a scoped, time-bounded permission to act for you?" |

A grant is more dangerous than a transaction because it is **persistent** and
**open-ended**: one signature can authorize *every* future action. Attackers
noticed immediately — researchers found that the vast majority of early
mainnet 7702 delegations pointed at copy-pasted "sweeper" contracts.

Meanwhile, the Ethereum Foundation's Clear Signing effort (ERC-7730) gives
wallets human-readable descriptions of *contract calls* — but the ERC-7730
spec explicitly does not cover 7702 authorizations or wallet permission
requests. **That gap is PermissionLens.**

What PermissionLens outputs for any grant, in every case:

1. **Who** is granting (the authority / delegator).
2. **To whom** (a known wallet implementation? an unverified contract? *anyone*?).
3. **Where** (one chain, a list, or *all chains*).
4. **What scope** (full control vs. specific targets/methods/amounts).
5. **For how long** (expiry, or "until revoked").
6. **How to undo it**.
7. **Risk flags**, each with evidence.

---

## Part 2 — Foundations: keys, signatures, replay protection

### 2.1 Accounts

- **EOA (externally owned account):** controlled by a secp256k1 private key.
  Historically had *no code*. Address = last 20 bytes of `keccak256(pubkey)`.
- **Contract account:** has code, no private key. Acts only when called.
- **Smart account:** a contract account designed to *be a wallet* — its code
  decides what counts as a valid authorization (multisig, passkey, session key…).
- **7702-delegated EOA (new):** an EOA whose code field contains a pointer to a
  contract. It still has its private key *and* now runs contract code.

### 2.2 ECDSA signatures in 90 seconds

A signature is `(r, s, v)` (or `yParity` instead of `v`) over a 32-byte hash.
Anyone holding the hash and signature can run `ecrecover(hash, v, r, s)` and
get the signer's address. Consequences that matter for us:

- **You only ever sign a hash.** Everything about "what was signed" depends on
  how that hash was constructed. If a wallet lets a site ask it to sign an
  arbitrary 32-byte hash (`eth_sign`), the user cannot know what they signed —
  it could be a transaction, a permit, or a 7702 authorization.
- **Malleability (EIP-2):** for every valid `(r, s)` there is another valid
  `(r, n − s)`. Ethereum requires `s ≤ n/2` ("low-s"). 7702 enforces this for
  authorization tuples too.
- **Domain separation:** protocols prefix the data with a unique byte or
  structure before hashing so a signature for one purpose can never be valid
  for another. 7702 uses the magic byte `0x05`; EIP-191 personal messages use
  `"\x19Ethereum Signed Message:\n"`; EIP-712 uses `0x1901`.

### 2.3 Replay protection

A signature is replayable unless something makes it single-use or scoped:

| Mechanism | Protects against |
|---|---|
| **Nonce** | Using the same signature twice on the same chain |
| **Chain ID** | Using a signature from chain A on chain B |
| **Verifying contract / domain** | Using a signature for contract A on contract B |
| **Expiry / deadline** | Using an old signature later |

**Keep this table in mind.** Most risk flags PermissionLens raises are
"one of these protections is missing or weakened": 7702 `chain_id = 0` removes
chain scoping; a delegation with no timestamp caveat has no expiry; an
ERC-7710 delegation to `ANY_DELEGATE` removes the "who may use it" binding.

---

## Part 3 — Everything a wallet can be asked to sign

| RPC method | Standard | Hash construction | Risk notes |
|---|---|---|---|
| `eth_sendTransaction` | tx types 0, 1 (EIP-2930), 2 (EIP-1559), 3 (EIP-4844), **4 (EIP-7702)** | `keccak256(type ‖ rlp(payload))` | Type 4 carries an `authorization_list` |
| `personal_sign` | EIP-191 | `keccak256("\x19Ethereum Signed Message:\n" + len + msg)` | Usually harmless text — but some protocols verify these |
| `eth_signTypedData_v4` | EIP-712 | `keccak256(0x1901 ‖ domainSeparator ‖ hashStruct(msg))` | Permits, Permit2, orders, **ERC-7710 delegations**, smart-account execution intents |
| `eth_sign` | none | signs raw 32 bytes | **Can be anything**, including a 7702 authorization digest. Most wallets disable or heavily warn |
| `wallet_sendCalls` | ERC-5792 | wallet decides | Batched calls; the wallet may upgrade the account via 7702 as part of it |
| `wallet_requestExecutionPermissions` | ERC-7715 | wallet decides | Grants a permission; the wallet returns a context (often a signed 7710 delegation) |

**Lesson from history — Permit/Permit2 phishing.** EIP-2612 `permit` and
Uniswap's Permit2 let users sign off-chain token approvals. Phishers learned to
request these because many wallets showed them as unreadable JSON. That entire
drainer era is the reason Clear Signing exists. Authorizations and delegations
are the next, more powerful version of the same problem: *off-chain signature,
on-chain power*.

---

## Part 4 — Account abstraction landscape

You need a map of the ecosystem to know *which* delegate contracts and
permission systems are legitimate.

### 4.1 ERC-4337 (2023–)
Smart accounts without protocol changes. Users sign **UserOperations**;
**bundlers** package them into transactions to a singleton **EntryPoint**
contract; **paymasters** can sponsor gas. Session keys in 4337 are usually
account *modules* (validators) that accept a second key with limits.

### 4.2 ERC-7579 — modular smart accounts
A minimal interface so modules (validators, executors, hooks, fallbacks) work
across account vendors (Safe, Kernel, Nexus, …). Key concept: **execution
mode** (`ModeCode`): single call vs. batch vs. delegatecall, revert vs. try.
ERC-7710 reuses this execution interface. Rhinestone's *Smart Sessions* is a
7579 session-key module — a later decoding target.

### 4.3 ERC-1271 / ERC-6492 / ERC-7739
- **1271:** how a contract says "this signature is valid for me"
  (`isValidSignature(hash, sig)`).
- **6492:** validating signatures of accounts not yet deployed.
- **7739:** "readable typed signatures" for smart accounts — nests the app's
  EIP-712 data so the user still sees it, and prevents one signature being
  replayed across multiple accounts owned by the same key. Relevant because a
  7702-delegated EOA is a smart account and should use these defenses.

### 4.4 ERC-5792 — `wallet_sendCalls`
Dapps ask the wallet for an *outcome* ("do these calls") and query
*capabilities* (atomic batching, paymaster, permissions). This is how
most legitimate 7702 upgrades happen: the wallet itself decides to delegate to
its own audited implementation. **Dapps generally should not be the ones asking
for 7702 authorizations.**

### 4.5 EIP-7702 (Pectra, May 2025)
EOAs get smart-account powers by pointing to a delegate contract. Part 5.

### 4.6 Native account abstraction — the 2026 split
- **EIP-8141 (Frame Transactions):** Ethereum L1 direction; labeled
  "must-ship" for the Hegotá upgrade. Accounts define their own validation and
  gas payment natively.
- **EIP-8130 (Keystore tx type):** Base's direction, with an on-chain keystore.
- In September 2026 the teams stopped trying to converge. Wallets may need to
  support both. **Design implication:** keep PermissionLens's internal model
  ("a grant") independent of any one standard, so new grant types plug in as
  new *parsers*.

---

## Part 5 — EIP-7702 in depth

### 5.1 The transaction

Type `0x04` ("set code") transaction:

```
rlp([chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
     destination, value, data, access_list, authorization_list,
     signature_y_parity, signature_r, signature_s])
```

`authorization_list` is non-empty; each entry is a tuple:

```
[chain_id, address, nonce, y_parity, r, s]
```

**Important:** the transaction *sender* and the authorization *signers* can be
different people. A relayer can submit a type-4 tx containing authorizations
signed by other users. That is how gas-sponsored upgrades work — and how an
attacker who has collected an authorization signature can use it.

### 5.2 What exactly is signed

```
authority_digest = keccak256( 0x05 ‖ rlp([chain_id, address, nonce]) )
```

- `0x05` = `MAGIC`, domain separation (no collision with tx types or EIP-191).
- `address` = the **delegate** (the code to run as your account).
- `nonce` = the authority's account nonce at the time of processing.
- `chain_id` = the chain, or **`0` = valid on every chain**.

Note what is **not** in the digest: no expiry, no scope, no description of what
the delegate can do. The signature is effectively "run whatever code lives at
`address`."

Verified TypeScript (viem 2.56.8) — compute the digest by hand and compare it
to the library:

```ts
import { keccak256, concat, toRlp, numberToHex } from "viem";
import { hashAuthorization, recoverAuthorizationAddress } from "viem/utils";

// RLP encodes the integer 0 as the empty string, not as a 0x00 byte.
const rlpInt = (n: bigint) => (n === 0n ? "0x" : numberToHex(n));

const auth = {
  chainId: 1,
  address: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B" as const,
  nonce: 7,
};

const manual = keccak256(
  concat(["0x05", toRlp([rlpInt(BigInt(auth.chainId)), auth.address, rlpInt(BigInt(auth.nonce))])]),
);
console.log(manual === hashAuthorization(auth)); // true

// Given a signed tuple {chainId, address, nonce, r, s, yParity}:
// const authority = await recoverAuthorizationAddress({ authorization: signed });
```

> The `rlpInt(0n) → "0x"` detail is a classic bug. Encoding zero as `0x00`
> produces a different digest, and your decoder would "recover" a random
> address. Make it a unit test.

### 5.3 What happens on-chain

For each tuple, in order (failures skip the tuple, they don't revert the tx):

1. `chain_id` must be 0 or the current chain.
2. `nonce < 2**64 − 1`.
3. `authority = ecrecover(digest, y_parity, r, s)`; `s ≤ n/2`.
4. Authority's code must be **empty or already a delegation** (a real contract
   can't be overwritten).
5. Authority's current nonce must equal the tuple `nonce`.
6. Write the **delegation indicator** to the authority's code:
   `0xef0100 ‖ address` (23 bytes). `0xef` is a banned opcode prefix, so this
   can never collide with real deployed code.
7. Increment the authority's nonce.

Consequences to internalize:

- **Persistence:** the delegation stays until another authorization replaces
  it. It is not per-transaction.
- **Survives reverts:** delegation indicators are written even if the tx's
  execution later fails.
- **Last one wins:** multiple tuples for the same authority → the last valid
  one sets the code.
- **Clearing:** an authorization with `address = 0x000…000` resets the code to
  empty. This is "revoke."
- **Self-sponsored nuance:** if the tx sender is also an authority, the
  sender's nonce is incremented *before* the list is processed, so the tuple
  must use `current_nonce + 1`.
- **No chaining:** if the delegate is itself a delegated EOA, clients load its
  code once and stop (no following of pointers).
- **Detecting a delegated EOA:** `eth_getCode(address)` returns
  `0xef0100<20-byte delegate>`.

### 5.4 What the delegate can do

**Everything the account can do.** While delegated, any call to the EOA runs
the delegate's code in the EOA's context: its balance, its storage, its token
holdings (as `msg.sender` for outgoing calls). The private key *also* still
works. So the security question for any 7702 authorization is exactly:
**"Do I trust the code at `address` — on every chain this signature is valid
for — with my whole account?"**

### 5.5 Security considerations from the EIP (you will turn these into checks)

- **Front-running initialization:** delegation can't run a constructor. If a
  delegate needs setup (e.g., "set my owner/guardian"), an observer can call
  `initialize` first. Good delegates require the setup data to be signed by the
  EOA (verified with `ecrecover`) — or are stateless.
- **Storage collisions:** switching from delegate A to B reuses the same
  storage. B may misread A's leftovers. Good delegates use namespaced storage
  (ERC-7201).
- **`tx.origin` assumptions break:** `require(tx.origin == msg.sender)` no
  longer guarantees "caller is a plain EOA."
- **Relayer griefing:** a sponsored user can invalidate their own
  authorization or sweep funds, wasting the relayer's gas.

---

## Part 6 — How 7702 gets abused

### 6.1 Sweepers on stolen keys (the bulk of the "97%")

When an attacker already has a victim's private key, they delegate the EOA to a
tiny contract whose `receive()` forwards any incoming ETH to them. Now anything
sent to the account — including ETH a rescuer sends to pay gas for a rescue —
is instantly swept. Conceptually:

```solidity
// Educational sketch of the pattern. Deploy only on a local anvil chain.
contract SweeperPattern {
    address payable constant COLLECTOR = payable(address(0xBEEF));
    receive() external payable { COLLECTOR.transfer(msg.value); }
}
```

Much of the early "most delegations are malicious" volume is this:
automation on already-compromised keys, not new phishing. Nuance matters —
PermissionLens can't save a stolen key, but it **can** label sweeper code
(Part 10) so wallets and explorers flag those accounts, and it catches phishing
that *tries to obtain* an authorization.

### 6.2 Phishing for an authorization

How can a phisher get a victim to sign a 7702 tuple?

| Vector | Explanation | Decoder response |
|---|---|---|
| Raw hash signing (`eth_sign`) | The authorization digest is just 32 bytes. A wallet that signs arbitrary hashes can be tricked into signing one. | Flag every raw-hash request as "unknowable — could be a full account takeover" |
| Wallets / SDKs that expose authorization signing to apps | Embedded wallets, bot wallets, custom SDKs that sign whatever the app passes | Decode the tuple and assess the delegate |
| Fake "upgrade your wallet" flows | A site mimics a wallet's upgrade screen | Unknown delegate → high risk; known-malicious → critical |

MetaMask mitigates this by only allowing its own delegator implementation and
not letting dapps inject a delegate address. Other wallets vary. That
inconsistency is why an open, reusable decoder is useful.

### 6.3 Abusing a *legitimate* delegation

Once delegated to a real smart-account implementation, **the account accepts
new kinds of signatures** — typically EIP-712 "execute these calls" messages or
batch intents validated by the delegate. A phisher then doesn't need a new 7702
signature; they request an innocuous-looking typed-data signature that the
delegate treats as an execution order. Inferno Drainer–style attacks bundled
approvals and transfers into a single batch executed through the delegator.

→ PermissionLens must also decode **typed data addressed to known delegate
implementations** and say "this signature authorizes executing these calls."

### 6.4 Other patterns to flag

- **`chain_id = 0`:** one signature, valid on every EVM chain that supports
  7702 — including chains where `address` hosts *different* code (or none yet
  → an attacker can deploy there later, e.g. via CREATE2 at a predictable
  address).
- **Future nonces:** a tuple with `nonce` well above the account's current nonce
  can be held and used later, once the nonce catches up.
- **Upgradeable delegates:** if `address` is a proxy, its owner can change the
  logic after you sign.
- **Delegate with `selfdestruct`/`delegatecall` to arbitrary input:** lets
  whoever controls input run arbitrary code as you.

---

## Part 7 — ERC-7710 delegations

ERC-7710 defines a **delegation manager** interface; MetaMask's
`delegation-framework` is the reference implementation (version 1.3.0 at time
of writing). This is the most common *structured* grant you'll decode.

### 7.1 The structs (from `src/utils/Types.sol`)

```solidity
struct Delegation {
    address delegate;     // who receives authority
    address delegator;    // the smart account granting it
    bytes32 authority;    // ROOT_AUTHORITY, or the hash of a parent delegation
    Caveat[] caveats;     // restrictions
    uint256 salt;         // uniqueness
    bytes signature;      // NOT part of the signed hash
}

struct Caveat {
    address enforcer;     // contract that checks the restriction
    bytes terms;          // restriction parameters (signed)
    bytes args;           // redeemer-supplied data (NOT signed)
}
```

Signed as EIP-712 with domain `name = "DelegationManager"`, `version = "1"`,
and type string:

```
Delegation(address delegate,address delegator,bytes32 authority,Caveat[] caveats,uint256 salt)Caveat(address enforcer,bytes terms)
```

### 7.2 Key constants

- `ROOT_AUTHORITY = 0xffff…ffff` — this delegation comes directly from the
  delegator (not a re-delegation).
- `ANY_DELEGATE = 0x0000…0a11` — **anyone** holding the signed delegation can
  redeem it. A legitimate use: "open" delegations (e.g., a bounty or a link).
  For a decoder: treat as a bearer instrument; if leaked, anyone can use it.

### 7.3 Caveats are the entire security model

A delegation with **no caveats** grants the delegate unrestricted execution for
the delegator. Every restriction lives in an enforcer. Some common ones and
their `terms` encodings (read from source):

| Enforcer | `terms` | Plain language |
|---|---|---|
| `TimestampEnforcer` | 32 bytes: `uint128 after ‖ uint128 before` | "Usable between A and B" (0 = no bound) |
| `AllowedTargetsEnforcer` | N × 20-byte addresses | "Only these contracts" |
| `AllowedMethodsEnforcer` | N × 4-byte selectors | "Only these functions" |
| `ValueLteEnforcer` | `uint256` | "Max ETH per call" |
| `NativeTokenTransferAmountEnforcer` | `abi.encode(uint256)` | "Max ETH in total" |
| `ERC20TransferAmountEnforcer` | 52 bytes: `address token ‖ uint256 max` | "Max N of token T in total" |
| `LimitedCallsEnforcer` | `uint256` | "At most N uses" |
| `RedeemerEnforcer` | N × 20-byte addresses | "Only these addresses may redeem" |

The repo has ~37 enforcers (streaming, periodic allowances, balance-change
checks, exact calldata, logical OR, …). **Crucial:** an enforcer is identified
by its **address**. A malicious request can include an "enforcer" at an
unknown address that looks restrictive but enforces nothing. So:
**unknown enforcer address ⇒ treat the caveat as absent**.

### 7.4 Redelegation chains

If `authority` is a delegation hash (not ROOT), this delegation is a
*re-delegation*: the delegate of a parent delegation passing on (a subset of)
its power. Caveats accumulate down the chain. To show the true scope you need
the whole chain.

### 7.5 Revocation

The delegator calls `disableDelegation(delegation)` on the manager
(on-chain, costs gas). Until then the signed delegation is valid wherever its
caveats allow. Off-chain "deleting" a signature does nothing.

---

## Part 8 — ERC-7715 permission requests

ERC-7715 (Draft) is the **request layer**: how a dapp asks a wallet for a
permission. ERC-7710 is often the **enforcement layer** behind it.

### 8.1 Request (`wallet_requestExecutionPermissions`)

```ts
type PermissionRequest = {
  chainId: Hex;
  from?: Address;          // the account (optional; wallet may choose)
  to: Address;             // who will receive the permission (session account / dapp)
  permission: {
    type: string;          // e.g. "native-token-allowance"
    isAdjustmentAllowed: boolean; // may the user/wallet edit it before granting?
    data: Record<string, any>;
  };
  rules?: { type: string; data: Record<string, any> }[]; // e.g. an expiry rule
}[];
```

### 8.2 Response

Everything in the request, plus:

- `context: Hex` — opaque blob the dapp uses to redeem (in MetaMask's
  implementation, encoded 7710 delegations).
- `dependencies: { factory, factoryData }[]` — accounts to deploy first.
- `delegationManager: Address` — where to redeem.

### 8.3 Other methods

- `wallet_revokeExecutionPermission({ permissionContext })`
- `wallet_getSupportedExecutionPermissions()` → which permission/rule types the
  wallet supports, per chain.
- `wallet_getGrantedExecutionPermissions()` → all non-revoked permissions.

### 8.4 Why a decoder is still needed

- Permission types are open-ended strings; different wallets implement
  different sets (MetaMask's Advanced Permissions ship stream and periodic
  token allowances). A dapp can request a type the user's wallet renders
  poorly.
- The `context` blob is what actually gets enforced. **Cross-check:** decode
  the `context` into 7710 delegations and confirm the caveats match what the
  request *said* (e.g., the request says "10 USDC/day" but the delegation has
  no period enforcer). A mismatch is a critical finding.
- The spec is still a draft; field names have changed across revisions.
  Parsers must be versioned.

---

## Part 9 — Clear Signing and ERC-7730

### 9.1 What it is

ERC-7730 is a JSON descriptor format that tells a wallet how to display a
contract call or EIP-712 message. The Ethereum Foundation's Trillion Dollar
Security initiative now stewards a public registry of descriptors
(`github.com/ethereum/clear-signing-erc7730-registry`).

Skeleton of a descriptor (v2 schema):

```json
{
  "$schema": "https://eips.ethereum.org/assets/eip-7730/erc7730-v2.schema.json",
  "context": {
    "contract": { "deployments": [{ "chainId": 1, "address": "0x…" }] }
  },
  "metadata": { "owner": "Example Protocol" },
  "display": {
    "formats": {
      "transfer(address to,uint256 value)": {
        "intent": "Send tokens",
        "fields": [
          { "path": "to", "label": "To", "format": "addressName" },
          { "path": "value", "label": "Amount", "format": "tokenAmount" }
        ]
      }
    }
  }
}
```

Formats include `raw`, `amount`, `tokenAmount`, `nftName`, `date`, `duration`,
`unit`, `enum`, `chainId`, `addressName`, `tokenTicker`, `calldata`.

### 9.2 Where PermissionLens fits

- ERC-7730 answers: *"what does this call do?"*
- It does **not** cover 7702 authorizations or permission requests.
- PermissionLens answers: *"what authority does this signature grant, to whom,
  where, for how long?"*

Two ways to integrate, both in the plan:

1. **Reuse** ERC-7730 descriptors to render the *calls* inside a batch or a
   delegation's allowed methods (don't reinvent call display).
2. **Propose** a descriptor extension for *delegate implementations*
   ("this address is MetaMask's stateless delegator vX, audited by …,
   capabilities: batching, session keys; revocation: …"). That's a standards
   contribution with real reach.

Clear Signing's current coverage is low (≈1.65% of non-token mainnet contract
calls per a public Dune dashboard), which means rendering will often fall back
to raw data. Design for graceful degradation.

---

## Part 10 — Bytecode literacy

To judge a delegate you often only have its bytecode.

### 10.1 Runtime code vs. metadata
`eth_getCode` returns *runtime* bytecode. Solidity appends a CBOR-encoded
metadata trailer (compiler version, source hash); the last 2 bytes give its
length. **Strip the trailer before hashing** so that identical logic compiled
from slightly different sources matches. Copy-pasted sweepers often differ only
in the embedded collector address — so also compute a *normalized* hash with
PUSH20 constants masked.

### 10.2 Proxies
- **EIP-1167 minimal proxy:** 45-byte pattern containing the implementation
  address. Detectable by byte pattern.
- **EIP-1967 proxies:** implementation address at storage slot
  `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`,
  admin at `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`.
- If a delegate is upgradeable, whoever controls the admin can change what your
  account does. Flag it, and show the admin.

### 10.3 A crude sweeper heuristic
Small runtime code (< ~200 bytes) that uses `SELFBALANCE` or `CALLVALUE`, a
hard-coded `PUSH20` address, and `CALL`, with no signature checks
(`ecrecover` precompile at `0x01` / no `CALLER` comparison). Heuristics produce
false positives — label them as "heuristic," never as proof.

### 10.4 Verified source
Sourcify and block explorers provide verified source code. "Verified" ≠ "safe,"
but "unverified" on a delegate that will control your account is a strong
warning.

---

## Part 11 — Static decoding vs. simulation

| | Static decoding (PermissionLens) | Simulation (Blockaid, Tenderly, wallet sims) |
|---|---|---|
| Input | The signature request only | Request + chain state + execution |
| Sees | Scope, lifetime, chains, delegate identity | Immediate balance changes |
| Misses | What *future* calls will do | **Future** misuse of a grant (a grant has no immediate effect!) |
| Runs | Offline, deterministic, in a hardware wallet, open source | Usually a hosted API |

The key insight: **simulating a 7702 authorization or a delegation shows
nothing bad** — no tokens move when you sign. The damage comes later. Grants
need *scope analysis*, which is static. That's the project's reason to exist
next to commercial simulators — complement them, don't compete.

---

## Part 12 — Hands-on labs

All labs run on a local anvil chain. Never use real funds or real keys.
Verified tools: Foundry 1.8.3 (`anvil`, `cast`, `forge`), viem 2.56.8.

### Lab 1 — Sign and inspect a 7702 authorization
```bash
anvil --hardfork prague
```
In another terminal (anvil prints funded test keys):
```bash
cast wallet sign-auth <DELEGATE_ADDRESS> --private-key <ANVIL_KEY_0> --rpc-url http://127.0.0.1:8545
```
Then reproduce the digest with the TypeScript in §5.2 and recover the
authority. **Goal:** you can go from tuple → digest → authority by hand.

### Lab 2 — Delegate an EOA and read the indicator
Deploy any small contract with `forge create`, then:
```bash
cast send --auth <DELEGATE_ADDRESS> --private-key <ANVIL_KEY_0> <ANY_ADDRESS> --rpc-url http://127.0.0.1:8545
cast code <ANVIL_ADDRESS_0> --rpc-url http://127.0.0.1:8545
```
Expect `0xef0100…<delegate>`. Now send another auth with the zero address and
confirm the code is cleared.

### Lab 3 — Watch a sweeper work (locally)
Deploy the `SweeperPattern` sketch from §6.1 (with `COLLECTOR` set to anvil
account #2), delegate account #1 to it, then send ETH to account #1 from
account #3. Watch #2's balance increase. **Goal:** feel why "just fund it to
rescue it" fails, and capture the runtime bytecode as your first sweeper
fixture.

### Lab 4 — Foundry cheatcodes for tests
forge-std's `Vm` exposes `signDelegation(implementation, privateKey)`,
overloads with an explicit `nonce` or `crossChain` flag, and
`attachDelegation(signedDelegation)`. Write a test that signs a cross-chain
(`chain_id = 0`) delegation and asserts your decoder flags it.

### Lab 5 — Decode a 7710 delegation
Clone `MetaMask/delegation-framework`, run its tests, and log a delegation
struct with 3 caveats (timestamp, allowed targets, ERC-20 amount). Decode each
caveat's `terms` by hand using the table in §7.3. Then change one enforcer to a
random address and explain why your decoder must now say "unrestricted."

### Lab 6 — Break the rlp zero
Encode an authorization with `nonce = 0` using `0x00` instead of the empty
string. Recover the "authority." Note that it is a random address. Keep this
as a regression test.

---

## Part 13 — Glossary

- **Authority** — the EOA that signed a 7702 authorization.
- **Delegate (7702)** — the contract whose code the EOA will run.
- **Delegation indicator** — `0xef0100 ‖ address`, the code of a delegated EOA.
- **Delegator / delegate (7710)** — the granting account / the receiving party.
- **Caveat / enforcer** — a restriction on a delegation / the contract that checks it.
- **Redemption** — using a delegation on-chain (`redeemDelegations`).
- **Sweeper** — delegate code that forwards incoming assets to an attacker.
- **Grant** — PermissionLens's standard-neutral term for "a signature that
  gives authority."
- **Blind signing** — approving data the wallet can't show meaningfully.
- **Clear signing** — showing a human-readable, verified description instead.
- **Codehash** — `keccak256(runtime code)`; normalized codehash strips
  metadata/constants for clone detection.

---

## Part 14 — Reading list

Specs (read in this order):
1. EIP-7702 — https://eips.ethereum.org/EIPS/eip-7702
2. ERC-7710 — https://eips.ethereum.org/EIPS/eip-7710
3. ERC-7715 — https://eips.ethereum.org/EIPS/eip-7715
4. ERC-7730 — https://eips.ethereum.org/EIPS/eip-7730
5. EIP-712, ERC-1271, ERC-5792, ERC-7579, ERC-7739, ERC-7201 (as needed)

Code:
- MetaMask delegation framework — https://github.com/MetaMask/delegation-framework
- Clear Signing registry — https://github.com/ethereum/clear-signing-erc7730-registry
- viem 7702 docs — https://viem.sh (search "EIP-7702")

Security research and context:
- EIP-7702 phishing paper — https://arxiv.org/pdf/2512.12174
- Zealynx: what auditors check after Pectra — https://www.zealynx.io/research/smart-contracts/eip-7702-wallet-security
- GoPlus: 7702 phishing and wallet protections — https://blog.gopluslabs.io/2025/06/03/financing/2025-06-03-Understanding-EIP-7702-Phishing-Attacks-A-Comprehensive-Guide-to-Protection-Strategies-for-Wallets/
- EF blog: Clear Signing — https://blog.ethereum.org/2026/05/12/clear-signing-announcement
- clearsigning.org contribute page — https://clearsigning.org/contribute/
- Dune: ERC-7730 coverage — https://dune.com/oren/clear-signing
- ethereum.org: Building on Ethereum in 2026 — https://ethereum.org/latest/building-on-ethereum-in-2026/
- The Block: Ethereum/Base AA split — https://www.theblock.co/news/ecosystems/2026-09-15-ethereum-base-account-abstraction-proposals-414775
