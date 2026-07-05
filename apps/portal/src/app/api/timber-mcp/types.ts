/**
 * Timber MCP · shared types + tiny runtime helpers used across the per-domain tool
 * modules (domains/deals.ts, crm.ts, catalog.ts), the tools.ts aggregator and the
 * route.ts dispatcher. This is pure code-motion out of the former monolithic
 * tools.ts + route.ts — no behaviour change. Keep it dependency-light so the
 * coverage test can import the tool catalog without dragging in the route handler.
 */
import type { ActorContext } from "@/features/orders/services/dealModel";

/** Deterministic deal-lifecycle steps that MUST each have at least one MCP tool. */
export const LIFECYCLE_STEPS = [
  "vocabulary",   // controlled vocab for intake (attributes)
  "org",          // organisations: create/link/read (CRM-synced)
  "deal_create",  // create a deal from intake (+ auto-spawn the buy leg — E7)
  "deal_read",    // list/get deals
  "line_items",   // set the deal's line items
  "deal_update",  // amend deal fields / external refs (incl. G3 signee overrides)
  "sourcing",     // start sourcing an existing sell deal → spawn its buy leg (J1/B1)
  "margin",       // owner margin approval on a deal (J1/E5, §5.3)
  "numbering",    // allocate Timber deal/document numbers
  "documents",    // assemble + generate/store documents
  "firming",      // quotation → firm order specification, in place (J1/D1, §8.2)
  "status",       // operational fulfilment status transitions
  "doc_chasing",  // find deals missing required documents
  "spine",        // query the spine: chain of deals + rolled-up status + lineage (E7)
  "gates",        // read + advance a deal's lifecycle stage through its gates (E7)
  "access",       // read + write the access-group / user management surface (E7 read + J3 write)
  "catalog",      // read catalog products/variants + read/write variant stock (J4)
] as const;

export type LifecycleStep = (typeof LIFECYCLE_STEPS)[number];

/**
 * T2 · The app-level capability a PER-USER MCP key's owner must hold to invoke a
 * WRITE tool — mirroring the SAME authorization the twin portal action applies.
 * RLS on the user-JWT client walls WHICH rows a key can touch; this descriptor
 * walls WHICH capability (which the row-level JWT can't express). Enforced in the
 * MCP route ONLY for a per-user key (`kind==="user"`); the env owner token is the
 * trusted owner-agent (admin/god) and bypasses it entirely.
 *
 *  - "admin"          → the owner is a REAL platform admin (org card, access-group
 *                       and margin-approval writes are owner/admin-only in the portal).
 *  - "deal_terms"     → deal_terms-editable (requireLineWriteAccess): deal terms,
 *                       line items, external refs, document assemble/generate/firm.
 *  - "orders_view"    → a house user with the orders.view module (create deal,
 *                       status, allocate code, advance/cancel, gate confirmation).
 *  - "suppliers_book" → suppliers-book access (start sourcing).
 *  - "catalogue"      → the catalogue.view module (variant stock write).
 */
export type UserWriteCapability =
  | "admin"
  | "deal_terms"
  | "orders_view"
  | "suppliers_book"
  | "counterparty"
  | "catalogue";

export interface ToolDef {
  name: string;
  description: string;
  readOnly: boolean;
  lifecycle: LifecycleStep;
  inputSchema: Record<string, unknown>;
}

// ── Request auth context (paired db + actor) ──────────────────────────────────
export type Role = "full" | "readonly";

/**
 * Resolved auth context for a request. `db` + `actor` are always paired at the
 * source (env → admin+SERVICE_ACTOR, user → user-JWT client + user actor) so a
 * tool can never run an admin client with a user actor or vice-versa.
 */
export type AuthCtx =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: "env"; role: Role; db: any; actor: ActorContext; orgId: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: "user"; role: Role; db: any; actor: ActorContext; orgId: string | null; keyId: string };

export type UserCtx = Extract<AuthCtx, { kind: "user" }>;

// ── Tool result + handler shapes ──────────────────────────────────────────────
export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}

/**
 * A per-tool dispatch handler = the body of that tool's former `switch` case. It
 * receives the raw MCP args + the resolved AuthCtx (db + actor + org, and — for the
 * two deal reads — the field-wall projection context). Each domain module exports a
 * `Record<toolName, ToolHandler>` and route.ts merges them into one HANDLERS lookup.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (args: any, ctx: AuthCtx) => Promise<ToolResult>;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toolOk(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }], isError: false };
}
export function toolErr(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
