import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie value format: <issued_at_ms>.<hmac_sha256_hex>
// Attributes: HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000
const COOKIE_NAME = "fabrique_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

function getSecret(): string {
  const secret = process.env.FABRIQUE_AUTH_SECRET;
  if (!secret) {
    throw new Error("FABRIQUE_AUTH_SECRET is not set");
  }
  return secret;
}

function getPassword(): string {
  const password = process.env.FABRIQUE_PASSWORD;
  if (!password) {
    throw new Error("FABRIQUE_PASSWORD is not set");
  }
  return password;
}

function hmacHex(message: string): string {
  return createHmac("sha256", getSecret()).update(message).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, "hex");
    bufB = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function signAuthCookie(): string {
  const issuedAt = Date.now();
  const mac = hmacHex(String(issuedAt));
  return `${issuedAt}.${mac}`;
}

export function verifyAuthCookie(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;

  const issuedAtStr = value.slice(0, dot);
  const mac = value.slice(dot + 1);

  if (!/^\d+$/.test(issuedAtStr)) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > MAX_AGE_MS) return false;
  if (!/^[0-9a-f]+$/i.test(mac)) return false;

  const expected = hmacHex(issuedAtStr);
  return safeEqualHex(expected, mac);
}

export function buildAuthCookieHeader(value: string): string {
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function buildClearAuthCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function readAuthCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq);
    if (name === COOKIE_NAME) {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

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

export function constantTimePasswordMatch(submitted: string): boolean {
  const expected = getPassword();
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still do a compare against ourselves to avoid length-based timing leak.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

// Rate limiting: simple in-process map. Survives-restart is a non-goal.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitAttempts: Map<string, number[]> = new Map();

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const prior = rateLimitAttempts.get(ip) ?? [];
  const recent = prior.filter((t) => t > cutoff);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitAttempts.set(ip, recent);
    return false;
  }

  recent.push(now);
  rateLimitAttempts.set(ip, recent);
  return true;
}

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

export function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  // Prevent //evil.com and /\evil.com style open redirects.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
