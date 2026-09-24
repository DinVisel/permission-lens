import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Nonce-based CSP (Next.js's documented pattern for the App Router, since a
 * static `next.config` header can't vary per-request). Rule 2 of
 * docs/progress/phase-4-surfaces.md: strict CSP, no analytics on pasted
 * content — `connect-src` stays open to arbitrary https/wss because the
 * "Check an address" tab talks to whatever RPC URL the user provides, but
 * there is nothing here that could exfiltrate pasted request data on its
 * own (paste-decoding never calls `fetch`).
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // React's dev mode needs eval() for its debugging features (stack
  // reconstruction); it never uses eval() in production, so this only
  // loosens the policy for `next dev`, not the deployed build.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
