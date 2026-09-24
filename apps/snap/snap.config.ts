import type { SnapConfig } from "@metamask/snaps-cli";

// snaps-utils spawns the SES-eval check by writing a `file://` URL from
// process.cwd() and resolving it back to a path without decoding percent
// escapes — on a checkout path with non-ASCII characters (e.g. this repo
// under a directory named "Masaüstü"), that resolves to a path that never
// existed, and the eval worker fails to launch (not a Snap bundle problem).
// Skip eval only on such a path; a normal ASCII checkout (CI included)
// still gets the real SES-compatibility check.
const hasNonAsciiPath = /[^\x00-\x7F]/.test(process.cwd());

const config: SnapConfig = {
  input: "src/index.ts",
  server: { port: 8080 },
  polyfills: { buffer: true },
  manifest: { update: true },
  evaluate: !hasNonAsciiPath,
};

export default config;
