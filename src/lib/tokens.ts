import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Capability-link tokens (eng-review): the raw token is the credential and lives
// ONLY in the URL; the DB stores its SHA-256 hash. 32 random bytes -> base64url.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Constant-time compare for hex hashes (defense-in-depth; lookups are by hash anyway).
export function tokenHashEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
