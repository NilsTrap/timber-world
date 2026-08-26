/**
 * Timber Projects — the server-side access resolver.
 *
 * ONE place gathers the facts (flag, session, effective modules) and hands them
 * to the pure `evaluateProjectsGate`; every entry point into the feature (both
 * routes and both loaders) goes through here, so there is no path that skips a
 * check. Deny by default: the caller gets `not_found` or `login` and nothing
 * else — no error text that would confirm a deal or the area exists.
 *
 * Two deliberate choices:
 *
 *  - Admin bypass is `isPlatformAdmin(session)` (portal_users.is_platform_admin)
 *    and NOT the legacy `isAdmin(session)` (`role === "admin"`). The database
 *    already draws the line there: `is_current_user_platform_admin()` backs
 *    every RLS policy, and the Epic-10 backfill only set the flag for admins
 *    with no organisation — so a legacy org-scoped "admin" is walled by RLS and
 *    must not be handed an in-app bypass either.
 *  - Every read of USER DATA uses the cookie-bound client (`createClient()`):
 *    `createAdminClient` is not imported anywhere under features/projects, so
 *    RLS (`can_access_deal_row` / `can_access_order`) stays authoritative —
 *    for admins too, who pass it on their own merits.
 *    The one service-role touch is indirect and deliberate: getUserEnabledModules
 *    and getAccessProfile read the RIGHTS tables (organization_modules,
 *    user_access_groups, access_group_rights) with the shared admin client, as
 *    every gate in this codebase does. Those are the caller's OWN permissions —
 *    gate logic, never someone else's deal data — and they only ever NARROW what
 *    follows.
 */
import { getSession, isPlatformAdmin, getUserEnabledModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccessProfile } from "@/lib/access";
import { fullAccessProfile, type AccessProfile } from "@/lib/access/types";
import { resolveFieldAccess, type FieldAccess } from "../orders/services/dealFields";
import type { ActorContext, DbClient } from "../orders/services/dealModel";
import { isTimberProjectsEnabled } from "./config";
import { evaluateProjectsGate } from "./gate";
import { personasForOrg, orgRoleFlagsFromRow, type ProjectPersona } from "./personas";
import type { ProjectsViewer } from "./types";
import { evaluateProjectCapabilities } from "./capabilities";

export type ProjectsActor =
  | {
      ok: true;
      db: DbClient;
      actor: ActorContext;
      orgId: string | null;
      organisationName: string | null;
      isPlatformAdmin: boolean;
      profile: AccessProfile;
      access: FieldAccess;
      portalUserId: string | null;
    }
  | { ok: false; deny: "not_found" | "login" };

/**
 * Resolve the caller, or deny. Order matters:
 * flag → session → admin → org → module → clients/profile.
 */
export async function resolveProjectsActor(): Promise<ProjectsActor> {
  // Flag first: behind a disabled flag we do no session or database work at all.
  const flagEnabled = isTimberProjectsEnabled();
  if (!flagEnabled) return { ok: false, deny: "not_found" };

  const session = await getSession();
  const admin = isPlatformAdmin(session);
  const orgId = session?.currentOrganizationId || session?.organisationId || null;

  const modules = admin
    ? new Set<string>()
    : await getUserEnabledModules(session?.portalUserId ?? "", orgId);

  const decision = evaluateProjectsGate({
    flagEnabled,
    authenticated: !!session,
    isPlatformAdmin: admin,
    orgId,
    modules,
  });
  if (!decision.ok) return { ok: false, deny: decision.deny };

  const db = await createClient();
  // Admins get the full field profile (as everywhere else in the deal layer);
  // everyone else gets their group-derived one, which is deny-by-default.
  const profile = admin
    ? fullAccessProfile()
    : await getAccessProfile(session?.portalUserId ?? null, orgId);

  return {
    ok: true,
    db,
    actor: {
      portalUserId: session?.portalUserId ?? null,
      isPlatformAdmin: admin,
      isServiceAgent: false,
      label: "portal-projects",
    },
    orgId,
    organisationName: session?.currentOrganizationName || session?.organisationName || null,
    isPlatformAdmin: admin,
    profile,
    access: resolveFieldAccess(profile),
    portalUserId: session?.portalUserId ?? null,
  };
}

/**
 * The persona strip for the page header: which hats the viewer's CURRENT
 * organisation wears. Read through the authenticated client (a member can
 * always read their own org row); a platform admin with no org gets no
 * personas, only the admin flag. Presentation only — see personas.ts.
 */
export async function resolveProjectsViewer(
  a: Extract<ProjectsActor, { ok: true }>,
): Promise<ProjectsViewer> {
  let personas: ProjectPersona[] = [];
  if (a.orgId) {
    const { data } = await a.db
      .from("organisations")
      .select("id, is_customer, is_trader, is_supplier, is_manufacturer, is_producer")
      .eq("id", a.orgId)
      .maybeSingle();
    personas = personasForOrg(orgRoleFlagsFromRow(data as Record<string, unknown> | null));
  }
  const capabilities = evaluateProjectCapabilities({
    isPlatformAdmin: a.isPlatformAdmin,
    hasDealCreate: a.profile.actions.has("deal:create"),
    organisationId: a.orgId,
    personas,
  });
  return {
    isPlatformAdmin: a.isPlatformAdmin,
    organisationId: a.orgId,
    organisationName: a.organisationName,
    personas,
    canEditTerms: a.isPlatformAdmin || a.access.domainEditable("deal_terms"),
    ...capabilities,
  };
}
