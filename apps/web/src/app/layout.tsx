import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "PermissionLens",
  description: "What authority does this signature actually grant? Decoded offline, in your browser.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the nonce here is what makes Next.js attach it (and thus satisfy
  // the CSP set in src/middleware.ts) to the script tags it generates for
  // this request — see https://nextjs.org/docs/app/guides/content-security-policy.
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
