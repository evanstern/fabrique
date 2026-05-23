import { timingSafeEqual } from "node:crypto";

function getPassword(): string {
  const password = process.env.FABRIQUE_PASSWORD;
  if (!password) {
    throw new Error("FABRIQUE_PASSWORD is not set");
  }
  return password;
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
