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
