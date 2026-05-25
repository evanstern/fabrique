import { readAuthCookie, verifyAuthCookie } from "./cookies";

// Request-gating helpers for auth-protected routes and redirect hygiene.
/** Require a valid auth cookie, redirecting browser requests or rejecting API calls. */
export function requireAuth(
  request: Request,
  opts: { api?: boolean } = {},
): void {
  const cookie = readAuthCookie(request);
  if (verifyAuthCookie(cookie)) return;

  if (opts.api) {
    throw new Response("unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const next = encodeURIComponent(`${url.pathname}${url.search}`);
  throw new Response(null, {
    status: 302,
    headers: { Location: `/login?next=${next}` },
  });
}

/** Derive the best client IP hint from forwarding headers. */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Keep post-login redirects on the local site only. */
export function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  // Prevent //evil.com and /\evil.com style open redirects.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
