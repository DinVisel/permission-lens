import { wordlist } from "@scure/bip39/wordlists/english";
import { validateMnemonic } from "@scure/bip39";

/**
 * Refuses pasted private keys and seed phrases before they ever reach
 * `decode()` — a `GrantInput` never needs either (docs/progress/phase-4-surfaces.md).
 * This is a best-effort, client-side-only guard, not a security boundary: it
 * exists to catch an honest mistake, not to promise detection of every
 * possible encoding of a secret.
 */
export interface SecretMatch {
  kind: "private-key" | "seed-phrase";
  message: string;
}

const HEX_64 = /^(0x)?[0-9a-fA-F]{64}$/;

export function detectPastedSecret(raw: string): SecretMatch | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (HEX_64.test(trimmed)) {
    return {
      kind: "private-key",
      message: "This looks like a private key (a 64-character hex string), not a signature request. It has been rejected — never paste a private key anywhere.",
    };
  }

  const mnemonicMatch = findMnemonic(trimmed);
  if (mnemonicMatch) {
    return {
      kind: "seed-phrase",
      message: `This looks like a ${mnemonicMatch.length}-word seed phrase, not a signature request. It has been rejected — never paste a seed phrase anywhere.`,
    };
  }

  return null;
}

/** 12 or 24 lowercase words, all in the BIP-39 English wordlist, that also pass the checksum — this is deliberately strict so ordinary prose or JSON keys don't false-positive. */
function findMnemonic(text: string): string[] | null {
  const words = text
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);

  for (const length of [24, 12]) {
    if (words.length !== length) continue;
    if (!words.every((w) => wordlist.includes(w))) continue;
    if (validateMnemonic(words.join(" "), wordlist)) return words;
  }

  return null;
}
