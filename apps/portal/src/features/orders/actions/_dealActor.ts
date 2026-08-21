/**
 * Shared resolver for the deal-layer server actions: authenticate, enforce the
 * orders.view module (platform admins bypass), and build the (db, actor) pair
 * the orderDeals / orderDocuments services expect. The server client enforces
 * RLS (can_access_order), so callers only touch deals they may access.
 *
 * Admin bypass is `isPlatformAdmin` (portal_users.is_platform_admin) and NOT the
 * legacy `isAdmin` (`role === "admin"`). The database already draws the line
 * there — every RLS policy is backed by `is_current_user_platform_admin()`, and
 * the Epic-10 backfill (20260201000005) only set the flag for admins with NO
 * organisation. A legacy org-scoped `role = "admin"` row is therefore walled by
 * RLS anyway, while `actor.isPlatformAdmin` used to hand it the in-app owner
 * powers: the field-wall bypass and the cross-leg spine reads that run on the
 * SERVICE-ROLE client (getSpineLegs / getSpineBuyLegs in dealActions). Those are
 * exactly the §9.1 chain facts ordinary users must never see, so the two
 * definitions of "admin" are now one.
 */
import { createClient } from "@/lib/supabase/server";
import { getSession, isPlatformAdmin, getUserEnabledModules } from "@/lib/auth";
import type { ActorContext, DbClient } from "../services/dealModel";

export type DealActorResult =
  | { ok: true; db: DbClient; actor: ActorContext; orgId: string | null }
  | { ok: false; error: string; code: string };

export async function resolveDealActor(): Promise<DealActorResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  const orgId = session.currentOrganizationId || session.organisationId || null;
  const admin = isPlatformAdmin(session);

  if (!admin) {
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("orders.view")) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const db = await createClient();
  const actor: ActorContext = {
    portalUserId: session.portalUserId ?? null,
    isPlatformAdmin: admin,
    isServiceAgent: false,
    label: "portal-user",
  };
  return { ok: true, db, actor, orgId };
}
