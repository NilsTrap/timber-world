/**
 * Timber Projects — server-only feature flag.
 *
 * The Projects area is STAGING-ONLY while it is being built out: it ships in the
 * bundle but stays completely dormant unless the environment opts in. With the
 * flag absent (production, local dev) there is no nav item and both routes
 * return the plain 404 — the same response an unknown path gets.
 *
 * Read at CALL TIME (never at module scope, never inlined at build time), the
 * same style as `features/orders/services/documents/port.ts` — so the var does
 * not need to be in turbo.json `globalEnv` and a cached build cannot bake in a
 * stale value. Never import this from a `"use client"` module: a non-NEXT_PUBLIC
 * var is `undefined` in the browser, which would silently read as "off".
 */
export function isTimberProjectsEnabled(): boolean {
  return process.env.TIMBER_PROJECTS_ENABLED === "true";
}
