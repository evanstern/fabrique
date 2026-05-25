import { createHmac, timingSafeEqual } from "node:crypto";

// Auth cookie helpers: sign, verify, and format the single login cookie.
// Cookie value format: <issued_at_ms>.<hmac_sha256_hex>
// Attributes: HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000; Secure unless PUBLIC_URL is explicit HTTP
export const COOKIE_NAME = "fabrique_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

function getSecret(): string {
  const secret = process.env.FABRIQUE_AUTH_SECRET;
  if (!secret) {
    throw new Error("FABRIQUE_AUTH_SECRET is not set");
  }
  return secret;
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

/** Create the signed payload stored in the auth cookie. */
export function signAuthCookie(): string {
  const issuedAt = Date.now();
  const mac = hmacHex(String(issuedAt));
  return `${issuedAt}.${mac}`;
}

/** Verify the auth cookie signature and reject malformed or expired values. */
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

function cookieSecurityAttribute(): string {
  return process.env.PUBLIC_URL?.startsWith("http://") ? "" : "; Secure";
}

/** Build the Set-Cookie header for a successful login. */
export function buildAuthCookieHeader(value: string): string {
  return `${COOKIE_NAME}=${value}; HttpOnly${cookieSecurityAttribute()}; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

/** Build the Set-Cookie header that clears the auth cookie. */
export function buildClearAuthCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly${cookieSecurityAttribute()}; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Read the auth cookie from the incoming request headers. */
export function readAuthCookie(request: Request): string | undefined {
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
