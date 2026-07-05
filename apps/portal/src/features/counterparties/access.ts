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
import { createAdminClient } from "@/lib/supabase/admin";
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

/** Book-access decision without a session (T5). The inner check of
 *  requireBookAccess, factored to accept resolved CALLER FACTS so a non-session
 *  caller (the MCP user-scoped key) enforces the SAME per-book wall. `isAdmin` is
 *  the caller's admin-bypass bit (session path: isAdmin(session); MCP path:
 *  actor.isPlatformAdmin). Returns ok / a coded denial — no session object. */
export type BookCheck = { ok: true } | { ok: false; error: string; code: string };

export async function checkBookAccessByProfile(
  portalUserId: string | null,
  isAdmin: boolean,
  callerOrgId: string | null,
  book: CounterpartyBook,
): Promise<BookCheck> {
  if (isAdmin) return { ok: true };
  // L2 · the Traders book is ADMIN-ONLY — salespeople/purchasing must not see a
  // traders address book. No rights path exists for non-admins.
  if (book === "traders") return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  const profile = await getAccessProfile(portalUserId, callerOrgId);
  // Require BOTH the book action right AND the ceiling-capped module. Action
  // rights are not intersected with the org ceiling (unlike module rights),
  // so gating on the action alone would let a user in an EXTERNAL org — whose
  // org never enables the counterparties.* modules (migration 009 seeds them
  // for internal orgs only) — read/write the whole platform-wide book through
  // the service-role client. profile.modules IS ceiling-capped.
  if (!profile.actions.has(BOOK_ACTION[book]) || !profile.modules.has(BOOK_MODULE[book])) {
    return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  return { ok: true };
}

/** Auth + per-book right check. Admins pass; others need the action right. Thin
 *  session wrapper over checkBookAccessByProfile — one wall, two callers. */
export async function requireBookAccess(book: CounterpartyBook): Promise<BookAccess> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  const callerOrgId = session.currentOrganizationId || session.organisationId;
  const chk = await checkBookAccessByProfile(session.portalUserId, isAdmin(session), callerOrgId, book);
  if (!chk.ok) return { ok: false, error: chk.error, code: chk.code };
  return { ok: true, session, callerOrgId };
}

/**
 * T5 · Contact-access-for-org, profile-based twin of the session-bound
 * `requireContactAccessForOrg` in actions/orgContacts.ts. Derives the org's
 * book(s) from its role flags (clients=is_customer, suppliers=is_supplier OR
 * is_producer, traders=is_trader) and requires the caller to pass at least one.
 * Platform admins pass for ANY org (incl. trader orgs / orgs in no book). Reads
 * the org flags server-side (service role) — gate logic, not user-facing data.
 *
 * The MCP org-contact tools call THIS (the cookie session is unavailable); the
 * portal action keeps its own session-bound copy of the same derivation.
 */
export async function checkContactAccessForOrgByProfile(
  portalUserId: string | null,
  isAdmin: boolean,
  callerOrgId: string | null,
  organisationId: string,
): Promise<BookCheck> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: org, error } = await admin
    .from("organisations")
    .select("id, is_customer, is_supplier, is_producer, is_trader")
    .eq("id", organisationId)
    .maybeSingle();
  if (error) return { ok: false, error: "Failed to check access", code: "ACCESS_CHECK_FAILED" };
  if (!org) return { ok: false, error: "Organisation not found", code: "NOT_FOUND" };

  // Admins pass for any org — incl. trader orgs and orgs in no book.
  if (isAdmin) return { ok: true };

  // Trader orgs are admin-only for contacts too — parity with add-person's
  // absolute is_trader block. checkBookAccessByProfile("traders") is admin-only,
  // so a non-admin gets FORBIDDEN here even if the org also carries another flag.
  if (org.is_trader === true) {
    return checkBookAccessByProfile(portalUserId, isAdmin, callerOrgId, "traders");
  }

  const books: CounterpartyBook[] = [];
  if (org.is_customer === true) books.push("clients");
  if (org.is_supplier === true || org.is_producer === true) books.push("suppliers");
  for (const book of books) {
    const g = await checkBookAccessByProfile(portalUserId, isAdmin, callerOrgId, book);
    if (g.ok) return { ok: true };
  }
  return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
}
