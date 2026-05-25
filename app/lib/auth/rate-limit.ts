// In-memory login throttle. The boundary stays local to auth so request and
// session code do not need to know about attempt tracking.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitAttempts: Map<string, number[]> = new Map();

/** Check whether this IP can still attempt to log in. */
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
