import { getSession, isAdmin, isPlatformAdmin, getUserEnabledModules, type SessionUser } from "@/lib/auth";
import type { ActionResult, ActorContext } from "../types";

/** Build a service actor from a portal session (UI caller). */
export function resolveActor(session: SessionUser): ActorContext {
  return {
    portalUserId: session.portalUserId,
    isPlatformAdmin: isPlatformAdmin(session) || isAdmin(session),
    isServiceAgent: false,
    label: session.email,
  };
}

/**
 * Gate a deals action: admins pass; org users need `deals.view`. Returns an
 * error ActionResult to short-circuit, or null when allowed.
 */
export async function requireDeals(session: SessionUser | null): Promise<ActionResult<never> | null> {
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (isAdmin(session)) return null;
  const orgId = session.currentOrganizationId || session.organisationId;
  const modules = await getUserEnabledModules(session.portalUserId ?? "", orgId);
  if (!modules.has("deals.view")) {
    return { success: false, error: "Deals feature not enabled", code: "FORBIDDEN" };
  }
  return null;
}

export { getSession };
