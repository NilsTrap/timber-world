"use server";

/**
 * E4 · Counterparty actions (spec §9.3) — list/create/edit records in the two
 * walled address books (clients / suppliers) over the organisations table.
 *
 * Guard: platform admins pass; everyone else needs the book's action right
 * ("counterparty:clients" / "counterparty:suppliers") in their AccessProfile.
 *
 * DATA ACCESS NOTE: after the right check, reads and writes deliberately go
 * through createAdminClient() (service role, bypasses RLS). Org users cannot
 * see unrelated organisations under RLS BY DESIGN — a counterparty record is
 * an org the caller has no membership in, so the user-scoped client would
 * return nothing. The action-level right check above IS the gate; do not
 * "fix" this by switching to the user client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSetting } from "@/features/access/actions/platformSettings";
import { requireBookAccess } from "../access";
import type {
  ActionResult,
  CounterpartyBook,
  CounterpartyInput,
  CounterpartyRow,
} from "../types";

const COUNTERPARTY_COLUMNS =
  "id, code, name, registration_number, vat_number, legal_address, country, email, phone, website, bank_name, bank_account_number, bank_swift_code, default_signee_name, default_signee_role, is_active, is_customer, is_supplier, is_producer, is_trader";

/** Trim a value; empty → null (blank card fields store as NULL). */
function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): CounterpartyRow {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    registrationNumber: (row.registration_number as string | null) ?? null,
    vatNumber: (row.vat_number as string | null) ?? null,
    legalAddress: (row.legal_address as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    bankName: (row.bank_name as string | null) ?? null,
    bankAccountNumber: (row.bank_account_number as string | null) ?? null,
    bankSwiftCode: (row.bank_swift_code as string | null) ?? null,
    defaultSigneeName: (row.default_signee_name as string | null) ?? null,
    defaultSigneeRole: (row.default_signee_role as string | null) ?? null,
    isActive: row.is_active === true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isInBook(row: any, book: CounterpartyBook): boolean {
  if (book === "clients") return row.is_customer === true;
  if (book === "traders") return row.is_trader === true;
  return row.is_supplier === true || row.is_producer === true;
}

/**
 * Ensure symmetric organisation_trading_partners links between the caller's
 * org and the counterparty org — this is what makes the record pickable on
 * deals. Insert-ignoring-23505 idiom (same as addTradingPartner). Skips
 * silently when the caller has no org (platform-view admin).
 */
async function ensureTradingPartnerLinks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  callerOrgId: string | null,
  counterpartyOrgId: string,
  createdBy: string,
): Promise<void> {
  if (!callerOrgId || callerOrgId === counterpartyOrgId) return;
  const pairs = [
    { organisation_id: callerOrgId, partner_organisation_id: counterpartyOrgId },
    { organisation_id: counterpartyOrgId, partner_organisation_id: callerOrgId },
  ];
  for (const pair of pairs) {
    const { error } = await admin
      .from("organisation_trading_partners")
      .insert({ ...pair, created_by: createdBy });
    // Ignore duplicate key error (23505) — the link already exists.
    if (error && error.code !== "23505") {
      console.error("Failed to link counterparty as trading partner:", error);
    }
  }
}

/**
 * Q3 · Batched active-user count per org — mutates each row's `userCount`.
 * Mirrors getOrganisations' union logic so a CRM book shows the SAME number as
 * the admin Orgs table: legacy `portal_users.organisation_id` ∪ active
 * `organization_memberships` (deduped). One query per source — no N+1.
 */
async function attachUserCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  rows: CounterpartyRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const orgIds = rows.map((r) => r.id);

  const { data: legacyUsers } = await admin
    .from("portal_users")
    .select("id, organisation_id")
    .in("organisation_id", orgIds);

  // org_id -> set of legacy user ids (matches getOrganisations: unfiltered by is_active).
  const legacyByOrg = new Map<string, Set<string>>();
  for (const u of (legacyUsers ?? []) as Array<{ id: string; organisation_id: string | null }>) {
    if (!u.organisation_id) continue;
    if (!legacyByOrg.has(u.organisation_id)) legacyByOrg.set(u.organisation_id, new Set());
    legacyByOrg.get(u.organisation_id)!.add(u.id);
  }

  const { data: memberships } = await admin
    .from("organization_memberships")
    .select("organization_id, user_id")
    .eq("is_active", true)
    .in("organization_id", orgIds);

  // org_id -> count of active members NOT already counted via legacy.
  const extraByOrg = new Map<string, number>();
  for (const m of (memberships ?? []) as Array<{ organization_id: string; user_id: string }>) {
    if (legacyByOrg.get(m.organization_id)?.has(m.user_id)) continue;
    extraByOrg.set(m.organization_id, (extraByOrg.get(m.organization_id) ?? 0) + 1);
  }

  for (const r of rows) {
    r.userCount = (legacyByOrg.get(r.id)?.size ?? 0) + (extraByOrg.get(r.id) ?? 0);
  }
}

/** All records of one book, ordered by code. */
export async function listCounterparties(
  book: CounterpartyBook,
): Promise<ActionResult<CounterpartyRow[]>> {
  const g = await requireBookAccess(book);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  // Service-role read AFTER the right check — see DATA ACCESS NOTE above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let query = admin
    .from("organisations")
    .select(COUNTERPARTY_COLUMNS)
    .order("code", { ascending: true });
  query =
    book === "clients"
      ? query.eq("is_customer", true)
      : book === "traders"
        ? query.eq("is_trader", true)
        : query.or("is_supplier.eq.true,is_producer.eq.true");

  const { data, error } = await query;
  if (error) {
    console.error("Failed to list counterparties:", error);
    return { success: false, error: "Failed to load records", code: "FETCH_FAILED" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data || []) as any[]).map(mapRow);
  await attachUserCounts(admin, rows);
  return { success: true, data: rows };
}

/**
 * Create a counterparty record in one book.
 *
 * Code collision rules (spec §9.3):
 * - code already in THIS book → DUPLICATE.
 * - code is a client record and book="suppliers" → allowed to reuse ONLY when
 *   the purchasing_may_reuse_clients platform setting is true (the existing
 *   org just gets is_supplier=true). Clients never absorb suppliers.
 * - any other collision → CODE_TAKEN.
 */
export async function createCounterparty(
  book: CounterpartyBook,
  input: CounterpartyInput,
): Promise<ActionResult<CounterpartyRow>> {
  const g = await requireBookAccess(book);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const code = (input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return {
      success: false,
      error: "Code must be exactly 3 letters (A–Z)",
      code: "VALIDATION_ERROR",
    };
  }
  const name = input.name.trim();
  if (!name) {
    return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };
  }

  // Service-role access AFTER the right check — see DATA ACCESS NOTE above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: existing, error: lookupError } = await admin
    .from("organisations")
    .select(COUNTERPARTY_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  if (lookupError) {
    console.error("Failed to check counterparty code:", lookupError);
    return { success: false, error: "Failed to create record", code: "CREATE_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let row: any;

  if (existing) {
    if (isInBook(existing, book)) {
      const singular = book === "clients" ? "client" : book === "traders" ? "trader" : "supplier";
      return {
        success: false,
        error: `A ${singular} with code ${code} already exists`,
        code: "DUPLICATE",
      };
    }
    if (book === "suppliers" && existing.is_customer === true) {
      // Reuse a client record on the supplier side — only if the platform
      // setting allows it (spec §9.3 admin toggle).
      const setting = await getPlatformSetting("purchasing_may_reuse_clients");
      const mayReuse = setting.success && setting.data.value === true;
      if (!mayReuse) {
        return {
          success: false,
          error: `Code ${code} belongs to a client record. Reusing client records on the supplier side is disabled by the platform settings.`,
          code: "CODE_TAKEN",
        };
      }
      const { data: updated, error: reuseError } = await admin
        .from("organisations")
        .update({ is_supplier: true })
        .eq("id", existing.id)
        .select(COUNTERPARTY_COLUMNS)
        .single();
      if (reuseError || !updated) {
        console.error("Failed to reuse client record as supplier:", reuseError);
        return { success: false, error: "Failed to create record", code: "CREATE_FAILED" };
      }
      row = updated;
    } else {
      // Clients never absorb suppliers; other orgs (e.g. internal) are off-limits.
      return {
        success: false,
        error: `Code ${code} is already taken by another organisation`,
        code: "CODE_TAKEN",
      };
    }
  } else {
    const { data: created, error: insertError } = await admin
      .from("organisations")
      .insert({
        code,
        name,
        // Traders are the house's OWN companies (internal); clients/suppliers
        // are external counterparties.
        is_external: book !== "traders",
        is_active: true,
        ...(book === "clients"
          ? { is_customer: true }
          : book === "traders"
            ? { is_trader: true }
            : { is_supplier: true }),
        registration_number: nn(input.registrationNumber),
        vat_number: nn(input.vatNumber),
        legal_address: nn(input.legalAddress),
        country: nn(input.country)?.toUpperCase() ?? null,
        email: nn(input.email),
        phone: nn(input.phone),
        website: nn(input.website),
        bank_name: nn(input.bankName),
        bank_account_number: nn(input.bankAccountNumber),
        bank_swift_code: nn(input.bankSwiftCode),
        default_signee_name: nn(input.defaultSigneeName),
        default_signee_role: nn(input.defaultSigneeRole),
      })
      .select(COUNTERPARTY_COLUMNS)
      .single();
    if (insertError || !created) {
      if (insertError?.code === "23505") {
        return { success: false, error: `Code ${code} is already taken`, code: "CODE_TAKEN" };
      }
      console.error("Failed to create counterparty:", insertError);
      return { success: false, error: "Failed to create record", code: "CREATE_FAILED" };
    }
    row = created;
  }

  // Link the record to the caller's org so it becomes pickable on deals.
  await ensureTradingPartnerLinks(admin, g.callerOrgId, row.id, g.session.id);

  return { success: true, data: mapRow(row) };
}

/**
 * Edit a counterparty record's card fields (never the code) and toggle
 * is_active. Only touches rows that belong to the given book.
 */
export async function updateCounterparty(
  book: CounterpartyBook,
  id: string,
  input: CounterpartyInput,
): Promise<ActionResult<CounterpartyRow>> {
  const g = await requireBookAccess(book);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const name = input.name.trim();
  if (!name) {
    return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };
  }

  // Service-role access AFTER the right check — see DATA ACCESS NOTE above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: existing } = await admin
    .from("organisations")
    .select(COUNTERPARTY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  // The book flag check keeps each book walled: a clients-right holder can
  // never edit a supplier row through this action (and vice versa).
  if (!existing || !isInBook(existing, book)) {
    return { success: false, error: "Record not found", code: "NOT_FOUND" };
  }

  const { data: updated, error } = await admin
    .from("organisations")
    .update({
      name,
      registration_number: nn(input.registrationNumber),
      vat_number: nn(input.vatNumber),
      legal_address: nn(input.legalAddress),
      country: nn(input.country)?.toUpperCase() ?? null,
      email: nn(input.email),
      phone: nn(input.phone),
      website: nn(input.website),
      bank_name: nn(input.bankName),
      bank_account_number: nn(input.bankAccountNumber),
      bank_swift_code: nn(input.bankSwiftCode),
      default_signee_name: nn(input.defaultSigneeName),
      default_signee_role: nn(input.defaultSigneeRole),
      ...(typeof input.isActive === "boolean" ? { is_active: input.isActive } : {}),
    })
    .eq("id", id)
    .select(COUNTERPARTY_COLUMNS)
    .single();
  if (error || !updated) {
    console.error("Failed to update counterparty:", error);
    return { success: false, error: "Failed to update record", code: "UPDATE_FAILED" };
  }

  return { success: true, data: mapRow(updated) };
}
