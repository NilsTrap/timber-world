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
  /** TIMBER_PROJECTS_ENABLED === "true" (isTimberProjectsEnabled()). */
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
  | { ok: true; reason: "admin" | "module" }
  | { ok: false; deny: "not_found" | "login" };

/** The module a non-admin needs to reach Projects (exact match, no prefix). */
export const PROJECTS_MODULE = "orders.view";

/**
 * Decide whether this viewer may reach Projects. First match wins:
 *
 * 1. flag off                    → not_found  (checked BEFORE auth, so a probe
 *                                  cannot use a /login redirect as an oracle
 *                                  that the area exists)
 * 2. no session                  → login
 * 3. is_platform_admin           → allow
 * 4. no current organisation     → not_found
 * 5. no exact `orders.view`      → not_found  (deliberately `has()`, NOT the
 *                                  nav's prefix-matching `moduleMatches` — an
 *                                  `orders.tab.*`-only user is not admitted)
 * 6. otherwise                   → allow
 */
export function evaluateProjectsGate(input: ProjectsGateInput): ProjectsGateDecision {
  if (!input.flagEnabled) return { ok: false, deny: "not_found" };
  if (!input.authenticated) return { ok: false, deny: "login" };
  if (input.isPlatformAdmin === true) return { ok: true, reason: "admin" };
  if (!input.orgId) return { ok: false, deny: "not_found" };
  if (!input.modules.has(PROJECTS_MODULE)) return { ok: false, deny: "not_found" };
  return { ok: true, reason: "module" };
}
