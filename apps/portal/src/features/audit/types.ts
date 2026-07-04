/**
 * Shared types for the audit feature (Q5 — login history, and later Q5.2).
 *
 * IMPORTANT: types live HERE, not in the "use server" action files. Exporting a
 * type/interface from a "use server" module can break all server actions on the
 * route at runtime (Turbopack), and type-check does not catch it.
 */

export interface LoginHistoryEntry {
  id: string;
  at: string;
  ip: string | null;
  userAgent: string | null;
}

export type AuditActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/* ───────────────────────── Q5.2 · action audit log ───────────────────────── */

export type AuditActorType = "human" | "service";

/** Payload passed to logAudit() by an instrumented mutation. */
export interface AuditLogInput {
  /** What happened, e.g. "organisation.create", "access_group.delete". */
  action: string;
  /** The kind of thing touched, e.g. "organisation", "portal_user", "catalog_product". */
  resourceType: string;
  resourceId?: string | null;
  organisationId?: string | null;
  /** Small describe-what-happened blob. NEVER put secrets (passwords/tokens) here. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Structural subset of the deal-model ActorContext — kept local so the audit
 * feature doesn't depend on the orders feature. When logAudit receives one with
 * isServiceAgent=true it tags the row actor_type='service' (e.g. the MCP
 * SERVICE_ACTOR, label "oscar-agent"); otherwise the human actor is derived from
 * the session.
 */
export interface AuditServiceActor {
  isServiceAgent: boolean;
  label?: string;
  portalUserId?: string | null;
}

/** A row as rendered in the admin audit view. */
export interface AuditLogEntry {
  id: string;
  at: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  organisationId: string | null;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorLabel: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditLogFilters {
  actorType?: AuditActorType;
  resourceType?: string;
  /** Free-text match against action / actor label / resource id. */
  search?: string;
  limit?: number;
}
