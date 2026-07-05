/**
 * Timber MCP tool catalog — STABLE AGGREGATOR (dispatch lives in route.ts).
 *
 * The tool DEFINITIONS + per-tool write capabilities + dispatch handlers are split
 * into per-domain modules so parallel work stays on disjoint files:
 *   - domains/deals.ts   — deal / spine / lifecycle / document surface
 *   - domains/crm.ts     — organisations + access-group / user management
 *   - domains/catalog.ts — controlled vocabulary + catalog products/stock
 * This file just concatenates them; the shared types + helpers live in ./types.
 *
 * Each tool carries a `lifecycle` tag mapping it to a step of the deal lifecycle;
 * the MCP-coverage check (tools-coverage.test.ts) asserts every step in
 * LIFECYCLE_STEPS is served by ≥1 tool, enforcing the completeness rule
 * (every deterministic lifecycle step is MCP-callable — no UI-only mutations).
 */
import { dealTools, dealCaps } from "./domains/deals";
import { crmTools, crmCaps } from "./domains/crm";
import { catalogTools, catalogCaps } from "./domains/catalog";
import type { ToolDef, UserWriteCapability } from "./types";

// Re-export the shared lifecycle catalog + tool/capability types so existing
// importers (route.ts, tools-coverage.test.ts) keep resolving them from "./tools".
export { LIFECYCLE_STEPS } from "./types";
export type { LifecycleStep, ToolDef, UserWriteCapability } from "./types";

/**
 * The full tool catalog = the concatenation of the per-domain ToolDef[] arrays.
 * Order is cosmetic (MCP clients key by name); each domain keeps its own internal
 * ordering. 40 tools across the LIFECYCLE_STEPS.
 */
export const TOOLS: ToolDef[] = [...dealTools, ...crmTools, ...catalogTools];

/**
 * T2 · Per-tool WRITE capability for a PER-USER MCP key — the single, auditable
 * source of truth the route enforces for `kind==="user"` calls (the env owner
 * token bypasses it). EVERY write tool (readOnly:false) MUST appear here; the
 * coverage test fails the build otherwise, and the route DENIES a user-actor write
 * whose tool is absent (deny-by-default). Each value is the SAME authorization the
 * twin portal action applies (see UserWriteCapability); RLS on the user JWT is the
 * DB backstop that additionally walls WHICH rows/tables the key may touch.
 *
 * RLS-vs-app split (verified against the migrations):
 *  - deal writes (orders / order_line_items): RLS is NOT admin-only — a non-admin
 *    party member with the row right can write, so RLS alone would let a
 *    visibility-only user mutate deal terms. The app capability here ("deal_terms"
 *    / "orders_view" / "suppliers_book") is the REQUIRED wall; RLS walls the rows.
 *  - org / access-group / catalog-stock / gate-config writes: RLS is admin-only
 *    (is_current_user_platform_admin) — a non-admin key is blocked at the DB. The
 *    "admin"/"catalogue" capability here mirrors the portal's own app gate and is
 *    defence-in-depth on top of that RLS backstop.
 */
export const USER_WRITE_CAPABILITY: Record<string, UserWriteCapability> = {
  ...dealCaps,
  ...crmCaps,
  ...catalogCaps,
};
