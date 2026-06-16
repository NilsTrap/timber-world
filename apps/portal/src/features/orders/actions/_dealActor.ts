/**
 * Shared resolver for the deal-layer server actions: authenticate, enforce the
 * orders.view module (admins bypass), and build the (db, actor) pair the
 * orderDeals / orderDocuments services expect. The server client enforces RLS
 * (can_access_order), so callers only touch deals they may access.
 */
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import type { ActorContext, DbClient } from "../services/dealModel";

export type DealActorResult =
  | { ok: true; db: DbClient; actor: ActorContext }
  | { ok: false; error: string; code: string };

export async function resolveDealActor(): Promise<DealActorResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("orders.view")) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const db = await createClient();
  const actor: ActorContext = {
    portalUserId: session.portalUserId ?? null,
    isPlatformAdmin: isAdmin(session),
    isServiceAgent: false,
    label: "portal-user",
  };
  return { ok: true, db, actor };
}
