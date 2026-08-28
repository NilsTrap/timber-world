/**
 * Timber Projects — the access decision, as a PURE function (no next/, no
 * supabase, no session imports) so the whole fail-closed matrix is unit-tested
 * without a DB. `access.ts` is the only place that gathers the inputs.
 *
 * Deny by default: every path that is not explicitly granted returns a denial,
 * and the denial for "you may not see this" is the SAME `not_found` the router
 * gives an unknown path — a probe must not be able to tell the two apart.
 *
 * Rights come from modules ONLY (org ceiling ∩ user groups, via
 * getUserEnabledModules). Organisation role flags (is_customer/is_trader/…) are
 * PRESENTATION ONLY and are deliberately not an input here — see personas.ts.
 */

export interface ProjectsGateInput {
  /** Retained compatibility input; Projects is now always enabled. */
  flagEnabled: boolean;
  /** Whether a portal session exists at all. */
  authenticated: boolean;
  /** portal_users.is_platform_admin ONLY — never the legacy `role === "admin"`. */
  isPlatformAdmin: boolean;
  /** The viewer's current organisation (cookie/primary membership). */
  orgId: string | null;
  /** Effective modules: org ceiling ∩ user group grants. */
  modules: ReadonlySet<string>;
}

export type ProjectsGateDecision =
  | { ok: true; reason: "authenticated" }
  | { ok: false; deny: "not_found" | "login" };

/** The module a non-admin needs to reach Projects (exact match, no prefix). */
export const PROJECTS_MODULE = "projects.view";

/**
 * Decide whether this viewer may reach Projects. First match wins:
 *
 * 1. no session                  → login
 * 2. platform admin              → allow
 * 3. active organisation user   → allow (row visibility remains RLS-backed)
 */
export function evaluateProjectsGate(input: ProjectsGateInput): ProjectsGateDecision {
  if (!input.authenticated) return { ok: false, deny: "login" };
  if (input.isPlatformAdmin === true) return { ok: true, reason: "authenticated" };
  if (!input.orgId) return { ok: false, deny: "not_found" };
  return { ok: true, reason: "authenticated" };
}
