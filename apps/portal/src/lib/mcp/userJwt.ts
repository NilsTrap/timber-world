/**
 * Epic T / T1 — mint a short-lived Supabase user JWT for a resolved MCP user key.
 *
 * The token is signed HS256 with the project's `SUPABASE_JWT_SECRET` (the same
 * secret GoTrue uses), carrying `sub = portal_users.auth_user_id`,
 * `role: 'authenticated'`, `aud: 'authenticated'`. Handed to a Supabase anon
 * client as the Authorization bearer, PostgREST runs every query as that user, so
 * `auth.uid()` (== sub) drives RLS — the SAME walls as the user's portal login.
 *
 * SECURITY — FAIL CLOSED: if `SUPABASE_JWT_SECRET` is absent this THROWS. The
 * route must let that propagate to a 401; it must NEVER fall back to the
 * RLS-bypassing admin client for a user-key request. The env FULL/READONLY owner
 * path does not use this and is unaffected when the secret is unset.
 */
import { SignJWT } from "jose";

/** User-key access tokens are intentionally short-lived — one MCP request's worth.
 *  A leaked minted token is useless within minutes; the durable credential is the
 *  API key (revocable), not the JWT. */
const TOKEN_TTL_SECONDS = 300;

export class McpJwtSecretMissingError extends Error {
  constructor() {
    super("SUPABASE_JWT_SECRET is not set — user-scoped MCP auth cannot mint a token (failing closed).");
    this.name = "McpJwtSecretMissingError";
  }
}

/**
 * Mint a Supabase-compatible user JWT. `authUserId` MUST be the portal user's
 * `auth_user_id` (the Supabase Auth uid), so RLS helpers that read `auth.uid()`
 * resolve to the right `portal_users` row.
 */
export async function mintUserAccessToken(authUserId: string): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new McpJwtSecretMissingError();

  const now = Math.floor(Date.now() / 1000);
  const key = new TextEncoder().encode(secret);

  return await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(authUserId)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(key);
}
