/**
 * E4 · Book-access wall — the single source of truth for "may the caller touch
 * this address book". Shared by the counterparty actions
 * (actions/counterparties.ts) and the CRM contacts actions (K1,
 * actions/orgContacts.ts).
 *
 * Rule: platform admins pass; the traders book (L2) is ADMIN-ONLY; everyone
 * else needs BOTH the per-book action right AND the ceiling-capped module.
 *
 * This is a plain server module (NOT "use server") on purpose so it can export
 * the const maps and the BookAccess type alongside the async guard — a
 * "use server" module may only export async functions.
 */

import { getSession, isAdmin } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import type { CounterpartyBook } from "./types";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

// clients/suppliers are rights-gated; the traders book (L2) is ADMIN-ONLY and
// never consults these (kept here only to satisfy the Record key set).
export const BOOK_ACTION: Record<CounterpartyBook, string> = {
  clients: "counterparty:clients",
  suppliers: "counterparty:suppliers",
  traders: "counterparty:traders",
};

export const BOOK_MODULE: Record<CounterpartyBook, string> = {
  clients: "counterparties.clients",
  suppliers: "counterparties.suppliers",
  traders: "counterparties.traders",
};

export type BookAccess =
  | { ok: true; session: Session; callerOrgId: string | null }
  | { ok: false; error: string; code: string };

/** Auth + per-book right check. Admins pass; others need the action right. */
export async function requireBookAccess(book: CounterpartyBook): Promise<BookAccess> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  const callerOrgId = session.currentOrganizationId || session.organisationId;
  if (isAdmin(session)) return { ok: true, session, callerOrgId };
  // L2 · the Traders book is ADMIN-ONLY — salespeople/purchasing must not see a
  // traders address book. No rights path exists for non-admins.
  if (book === "traders") return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  const profile = await getAccessProfile(session.portalUserId, callerOrgId);
  // Require BOTH the book action right AND the ceiling-capped module. Action
  // rights are not intersected with the org ceiling (unlike module rights),
  // so gating on the action alone would let a user in an EXTERNAL org — whose
  // org never enables the counterparties.* modules (migration 009 seeds them
  // for internal orgs only) — read/write the whole platform-wide book through
  // the service-role client. profile.modules IS ceiling-capped.
  if (!profile.actions.has(BOOK_ACTION[book]) || !profile.modules.has(BOOK_MODULE[book])) {
    return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  return { ok: true, session, callerOrgId };
}
