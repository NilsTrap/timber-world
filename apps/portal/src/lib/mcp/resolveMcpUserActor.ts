/**
 * Epic T / T1 — resolve a per-user MCP key into a user-scoped (db, actor) pair,
 * ATOMICALLY.
 *
 * SECURITY — the whole point of T1. A per-user key must never be able to exceed
 * its owner's portal walls. That guarantee rests on two things constructed
 * together here and NEVER separately:
 *   1. `db`   — a user-JWT-scoped anon client (RLS applies the user's walls). The
 *               row-level data walls come from THIS, not from trusting the actor.
 *   2. `actor`— isPlatformAdmin reflects the USER's REAL status (a salesperson key
 *               ⇒ false ⇒ no admin bypass in any app-level check). isServiceAgent
 *               is true only to tag the audit row actor_type='service' and to keep
 *               the document issuer null on the MCP channel — it must NOT be read
 *               anywhere as an authz bypass (see route header note + T2).
 *
 * Returning the pair together makes it structurally impossible for a caller to
 * hand an admin (RLS-bypassing) client a user actor, or vice-versa.
 *
 * FAIL CLOSED: returns null if the portal user is missing / has no auth identity;
 * THROWS (propagate to a 401 — never fall back to admin) if the JWT secret is
 * absent (mintUserAccessToken). The admin client is used ONLY to read the user's
 * identity row here; it is never returned.
 */
import type { ActorContext, DbClient } from "@/features/orders/services/dealModel";
import { createUserScopedClient } from "@/lib/supabase/userScoped";
import { mintUserAccessToken } from "./userJwt";

export interface McpUserContext {
  db: DbClient;
  actor: ActorContext;
  orgId: string | null;
}

/**
 * @param admin        service-role client — used ONLY to read the identity row.
 * @param portalUserId the key owner's portal_users.id.
 * @param orgId        the resolved org context (pin ▸ per-call arg ▸ primary).
 * @param keyLabel     the key's label, surfaced in the audit actor label.
 */
export async function resolveMcpUserActor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  portalUserId: string,
  orgId: string | null,
  keyLabel: string | null,
): Promise<McpUserContext | null> {
  // 1. Load the user's identity: the Supabase auth uid (JWT sub) + their REAL
  //    platform-admin status. Read via the admin client (RLS-agnostic lookup).
  const { data: user } = await admin
    .from("portal_users")
    .select("id, auth_user_id, is_platform_admin, is_active")
    .eq("id", portalUserId)
    .maybeSingle();

  // Fail closed: no user, deactivated, or no Supabase auth identity ⇒ no token
  // can be minted for them, so the key resolves to nothing (401).
  if (!user || user.is_active === false || !user.auth_user_id) return null;

  // 2. Mint the short-lived user JWT (sub = auth_user_id). Throws if the secret
  //    is missing — the route turns that into a 401 (never an admin fallback).
  const accessToken = await mintUserAccessToken(user.auth_user_id as string);

  // 3. Build the user-scoped RLS client + the matching actor — together.
  const db = createUserScopedClient(accessToken) as DbClient;
  const actor: ActorContext = {
    portalUserId,
    // Real status: a non-admin user's key is non-admin, full stop.
    isPlatformAdmin: user.is_platform_admin === true,
    // MCP channel marker (audit actor_type='service' + null document issuer).
    // NOT an authz bypass — data walls come from `db` (the user JWT), above.
    isServiceAgent: true,
    label: `mcp:${keyLabel ?? "key"}`,
  };

  return { db, actor, orgId };
}
