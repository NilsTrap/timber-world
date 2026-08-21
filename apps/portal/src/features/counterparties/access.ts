/**
 * Company-profile access wall.
 *
 * Every service-role read/write for Clients and Suppliers passes through this
 * module. A caller is exactly one of:
 *  - platform admin: every record in the requested book, may manage;
 *  - book manager: current-org trading partners in the exact granted book,
 *    may manage;
 *  - self viewer: the current membership organisation, read-only, when that
 *    organisation belongs to the requested book.
 *
 * Direct-ID denials deliberately collapse to NOT_FOUND so hidden organisation
 * ids cannot be enumerated.
 */

import { getSession, isPlatformAdmin, isSuperAdmin } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CounterpartyBook } from "./types";
import {
  canAccessCounterpartyRecord,
  decideCounterpartyBookMode,
  isOrganisationInBook,
  isOrganisationSelfInBook,
  isValidCounterpartyId,
  type CounterpartyAccessMode,
  type OrganisationBookFacts,
} from "./policy";

export {
  canAccessCounterpartyRecord,
  decideCounterpartyBookMode,
  isOrganisationInBook,
  isOrganisationSelfInBook,
  isValidCounterpartyId,
} from "./policy";
export type { CounterpartyAccessMode, OrganisationBookFacts } from "./policy";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

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
  | {
      ok: true;
      session: Session;
      callerOrgId: string | null;
      mode: CounterpartyAccessMode;
      canManage: boolean;
    }
  | { ok: false; error: string; code: string };

export type RecordAccess = BookAccess & { target?: OrganisationBookFacts & { id: string } };
export type BookCheck = { ok: true } | { ok: false; error: string; code: string };

async function resolveBookAccess(book: CounterpartyBook): Promise<BookAccess> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  const callerOrgId = session.currentOrganizationId || session.organisationId;
  const platformAdmin = isPlatformAdmin(session) || isSuperAdmin(session);
  if (platformAdmin) {
    return { ok: true, session, callerOrgId, mode: "admin", canManage: true };
  }

  let callerOrg: OrganisationBookFacts | null = null;
  if (callerOrgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data } = await admin
      .from("organisations")
      .select("is_customer, is_supplier, is_producer, is_manufacturer, is_trader")
      .eq("id", callerOrgId)
      .maybeSingle();
    callerOrg = data ?? null;
  }

  const profile = await getAccessProfile(session.portalUserId, callerOrgId);
  const hasExactBookGrant =
    profile.actions.has(BOOK_ACTION[book]) && profile.modules.has(BOOK_MODULE[book]);
  const mode = decideCounterpartyBookMode({
    book,
    platformAdmin,
    hasExactBookGrant,
    callerOrgId,
    callerOrg,
  });
  if (!mode) return { ok: false, error: "Not found", code: "NOT_FOUND" };
  return { ok: true, session, callerOrgId, mode, canManage: mode !== "self" };
}

/** List/page gate. Self viewers pass for their matching own-company book. */
export async function requireCounterpartyBookAccess(book: CounterpartyBook): Promise<BookAccess> {
  return resolveBookAccess(book);
}

/** Backward-compatible manager gate for existing callers. */
export async function requireBookAccess(book: CounterpartyBook): Promise<BookAccess> {
  const access = await resolveBookAccess(book);
  if (!access.ok || !access.canManage) {
    return access.ok
      ? { ok: false, error: "Permission denied", code: "FORBIDDEN" }
      : access;
  }
  return access;
}

/** Exact-book, exact-record wall used before returning any profile payload. */
export async function requireCounterpartyRecordAccess(
  book: CounterpartyBook,
  organisationId: string,
  intent: "read" | "manage" = "read",
): Promise<RecordAccess> {
  if (!isValidCounterpartyId(organisationId)) {
    return { ok: false, error: "Not found", code: "NOT_FOUND" };
  }
  const access = await resolveBookAccess(book);
  if (!access.ok) return access;
  if (intent === "manage" && !access.canManage) {
    return { ok: false, error: "Not found", code: "NOT_FOUND" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: target } = await admin
    .from("organisations")
    .select("id, is_customer, is_supplier, is_producer, is_manufacturer, is_trader")
    .eq("id", organisationId)
    .maybeSingle();
  if (!target || !(isOrganisationInBook(target, book) || (access.mode === "self" && isOrganisationSelfInBook(target, book)))) {
    return { ok: false, error: "Not found", code: "NOT_FOUND" };
  }

  let linked = false;
  if (access.mode === "manager") {
    const { data: link } = await admin
      .from("organisation_trading_partners")
      .select("partner_organisation_id")
      .eq("organisation_id", access.callerOrgId)
      .eq("partner_organisation_id", organisationId)
      .maybeSingle();
    linked = Boolean(link);
  }
  if (!canAccessCounterpartyRecord({
    mode: access.mode,
    callerOrgId: access.callerOrgId,
    targetOrgId: organisationId,
    linked,
    intent,
  })) {
    return { ok: false, error: "Not found", code: "NOT_FOUND" };
  }

  return { ...access, target };
}

/**
 * Profile-based contact guard retained for MCP callers. It applies the same
 * admin/manager/self facts and partner edge; no cookie-session bypass exists.
 */
export async function checkContactAccessForOrgByProfile(
  portalUserId: string | null,
  platformAdmin: boolean,
  callerOrgId: string | null,
  organisationId: string,
): Promise<BookCheck> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: target }, { data: callerOrg }] = await Promise.all([
    admin.from("organisations").select("id, is_customer, is_supplier, is_producer, is_manufacturer, is_trader").eq("id", organisationId).maybeSingle(),
    callerOrgId
      ? admin.from("organisations").select("id, is_customer, is_supplier, is_producer, is_manufacturer, is_trader").eq("id", callerOrgId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!target) return { ok: false, error: "Not found", code: "NOT_FOUND" };
  if (platformAdmin) return { ok: true };

  const profile = await getAccessProfile(portalUserId, callerOrgId);
  const books: CounterpartyBook[] = ["clients", "suppliers"];
  for (const book of books) {
    if (!(isOrganisationInBook(target, book) || (callerOrgId === organisationId && isOrganisationSelfInBook(target, book)))) continue;
    const hasExactBookGrant =
      profile.actions.has(BOOK_ACTION[book]) && profile.modules.has(BOOK_MODULE[book]);
    const mode = decideCounterpartyBookMode({
      book,
      platformAdmin,
      hasExactBookGrant,
      callerOrgId,
      callerOrg,
    });
    if (mode === "self" && callerOrgId === organisationId) return { ok: true };
    if (mode === "manager") {
      const { data: link } = await admin
        .from("organisation_trading_partners")
        .select("partner_organisation_id")
        .eq("organisation_id", callerOrgId)
        .eq("partner_organisation_id", organisationId)
        .maybeSingle();
      if (link) return { ok: true };
    }
  }
  return { ok: false, error: "Not found", code: "NOT_FOUND" };
}
