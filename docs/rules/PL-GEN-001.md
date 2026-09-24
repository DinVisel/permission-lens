# PL-GEN-001 — Signing a raw hash

**Severity:** critical
**Confidence:** certain
**Needs chain data:** no

## Condition

The request is `eth_sign` (or an equivalent raw-hash signing request): a
32-byte digest with no structure describing what it commits to.

## Why it matters

There is no way to know what a raw hash represents. It could be a harmless
message, or it could be the digest of a transaction, a 7702 authorization, or
anything else that moves funds or grants control. `eth_sign` is the classic
vector for "blind signing" attacks.

## What to do

Refuse to sign raw hashes from untrusted sources. Prefer typed data
(`eth_signTypedData_v4`) or an explicit transaction, both of which this
library (and the wallet's own UI) can actually decode.
