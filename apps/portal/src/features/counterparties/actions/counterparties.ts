"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSetting } from "@/features/access/actions/platformSettings";
import { deleteOrganisation } from "@/features/organisations/actions/deleteOrganisation";
import { crmSyncOrg } from "@/features/organisations/services/oscarCrm";
import { logAudit } from "@/features/audit/logAudit";
import {
  requireBookAccess,
  requireCounterpartyBookAccess,
  requireCounterpartyRecordAccess,
} from "../access";
import type {
  ActionResult,
  CounterpartyBook,
  CounterpartyBookContext,
  CounterpartyInput,
  CounterpartyProfile,
  CounterpartyRow,
} from "../types";

const COUNTERPARTY_COLUMNS =
  "id, code, name, registration_number, vat_number, legal_address, country, email, phone, website, bank_name, bank_account_number, bank_swift_code, default_signee_name, default_signee_role, logo_url, crm_org_id, is_active, is_customer, is_supplier, is_producer, is_manufacturer, is_trader";

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
    logoUrl: (row.logo_url as string | null) ?? null,
    isActive: row.is_active === true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isInBook(row: any, book: CounterpartyBook): boolean {
  if (book === "clients") return row.is_customer === true;
  if (book === "traders") return row.is_trader === true;
  return row.is_supplier === true || row.is_producer === true;
}

async function syncCrm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  row: any,
): Promise<void> {
  await crmSyncOrg(admin, {
    timberOrgId: row.id,
    code: row.code,
    name: row.name,
    legalAddress: row.legal_address ?? null,
    vatNumber: row.vat_number ?? null,
    registrationNumber: row.registration_number ?? null,
    country: row.country ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    bankName: row.bank_name ?? null,
    bankAccountNumber: row.bank_account_number ?? null,
    bankSwiftCode: row.bank_swift_code ?? null,
    isCustomer: row.is_customer === true,
    isManufacturer: row.is_manufacturer === true,
    isProducer: row.is_producer === true,
    crmOrgId: row.crm_org_id ?? null,
  });
}

async function ensureTradingPartnerLinks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  callerOrgId: string | null,
  counterpartyOrgId: string,
  createdBy: string,
): Promise<void> {
  if (!callerOrgId || callerOrgId === counterpartyOrgId) return;
  for (const pair of [
    { organisation_id: callerOrgId, partner_organisation_id: counterpartyOrgId },
    { organisation_id: counterpartyOrgId, partner_organisation_id: callerOrgId },
  ]) {
    const { error } = await admin
      .from("organisation_trading_partners")
      .insert({ ...pair, created_by: createdBy });
    if (error && error.code !== "23505") {
      console.error("Failed to link counterparty as trading partner:", error);
    }
  }
}

async function attachUserCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  rows: CounterpartyRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const orgIds = rows.map((r) => r.id);
  const [{ data: legacyUsers }, { data: memberships }] = await Promise.all([
    admin.from("portal_users").select("id, organisation_id").in("organisation_id", orgIds),
    admin.from("organization_memberships").select("organization_id, user_id").eq("is_active", true).in("organization_id", orgIds),
  ]);
  const usersByOrg = new Map<string, Set<string>>();
  for (const user of (legacyUsers ?? []) as Array<{ id: string; organisation_id: string | null }>) {
    if (!user.organisation_id) continue;
    if (!usersByOrg.has(user.organisation_id)) usersByOrg.set(user.organisation_id, new Set());
    usersByOrg.get(user.organisation_id)!.add(user.id);
  }
  for (const membership of (memberships ?? []) as Array<{ organization_id: string; user_id: string }>) {
    if (!usersByOrg.has(membership.organization_id)) usersByOrg.set(membership.organization_id, new Set());
    usersByOrg.get(membership.organization_id)!.add(membership.user_id);
  }
  for (const row of rows) row.userCount = usersByOrg.get(row.id)?.size ?? 0;
}

export async function getCounterpartyBookContext(
  book: CounterpartyBook,
): Promise<ActionResult<CounterpartyBookContext>> {
  const access = await requireCounterpartyBookAccess(book);
  if (!access.ok) return { success: false, error: access.error, code: access.code };
  return {
    success: true,
    data: { accessMode: access.mode, canManage: access.canManage },
  };
}

/** Scoped list: all for admin, linked partners for managers, own org for self. */
export async function listCounterparties(
  book: CounterpartyBook,
): Promise<ActionResult<CounterpartyRow[]>> {
  const access = await requireCounterpartyBookAccess(book);
  if (!access.ok) return { success: false, error: access.error, code: access.code };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let allowedIds: string[] | null = null;
  if (access.mode === "self") {
    allowedIds = access.callerOrgId ? [access.callerOrgId] : [];
  } else if (access.mode === "manager") {
    const { data: links, error: linkError } = await admin
      .from("organisation_trading_partners")
      .select("partner_organisation_id")
      .eq("organisation_id", access.callerOrgId);
    if (linkError) {
      console.error("Failed to load company links:", linkError);
      return { success: false, error: "Failed to load records", code: "FETCH_FAILED" };
    }
    allowedIds = (links ?? []).map((r: { partner_organisation_id: string }) => r.partner_organisation_id);
  }
  if (allowedIds && allowedIds.length === 0) return { success: true, data: [] };

  let query = admin.from("organisations").select(COUNTERPARTY_COLUMNS).order("code", { ascending: true });
  if (allowedIds) query = query.in("id", allowedIds);
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
  const rows = ((data ?? []) as any[]).map(mapRow);
  await attachUserCounts(admin, rows);
  return { success: true, data: rows };
}

/** Direct profile read, including contacts and delivery addresses. */
export async function getCounterpartyProfile(
  book: CounterpartyBook,
  id: string,
): Promise<ActionResult<CounterpartyProfile>> {
  const access = await requireCounterpartyRecordAccess(book, id, "read");
  if (!access.ok) return { success: false, error: "Not found", code: "NOT_FOUND" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: org, error }, { data: addresses }, { data: contacts }] = await Promise.all([
    admin.from("organisations").select(COUNTERPARTY_COLUMNS).eq("id", id).maybeSingle(),
    admin.from("organisation_delivery_addresses").select("id, label, address, contact_name, contact_phone, contact_hours, is_default").eq("organisation_id", id).order("is_default", { ascending: false }).order("label"),
    admin.from("org_contacts").select("id, name, role_title, email, phone, is_primary, is_active").eq("organisation_id", id).order("is_primary", { ascending: false }).order("name"),
  ]);
  if (error || !org) return { success: false, error: "Not found", code: "NOT_FOUND" };
  return {
    success: true,
    data: {
      ...mapRow(org),
      accessMode: access.mode,
      canManage: access.canManage,
      deliveryAddresses: (addresses ?? []).map((a: Record<string, unknown>) => ({
        id: String(a.id), label: String(a.label), address: String(a.address),
        contactName: (a.contact_name as string | null) ?? null,
        contactPhone: (a.contact_phone as string | null) ?? null,
        contactHours: (a.contact_hours as string | null) ?? null,
        isDefault: a.is_default === true,
      })),
      contacts: (contacts ?? []).map((c: Record<string, unknown>) => ({
        id: String(c.id), name: String(c.name), roleTitle: (c.role_title as string | null) ?? null,
        email: (c.email as string | null) ?? null, phone: (c.phone as string | null) ?? null,
        isPrimary: c.is_primary === true, isActive: c.is_active === true,
      })),
    },
  };
}

export async function createCounterparty(
  book: CounterpartyBook,
  input: CounterpartyInput,
): Promise<ActionResult<CounterpartyRow>> {
  const access = await requireBookAccess(book);
  if (!access.ok) return { success: false, error: access.error, code: access.code };
  if (book === "traders" && access.mode !== "admin") {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  const code = (input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { success: false, error: "Code must be exactly 3 letters (A–Z)", code: "VALIDATION_ERROR" };
  }
  const name = input.name.trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: existing, error: lookupError } = await admin.from("organisations").select(COUNTERPARTY_COLUMNS).eq("code", code).maybeSingle();
  if (lookupError) return { success: false, error: "Failed to create record", code: "CREATE_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let row: any;
  if (existing) {
    if (isInBook(existing, book)) {
      return { success: false, error: `A ${book === "clients" ? "client" : book === "suppliers" ? "supplier" : "trader"} with code ${code} already exists`, code: "DUPLICATE" };
    }
    if (book === "suppliers" && existing.is_customer === true) {
      const setting = await getPlatformSetting("purchasing_may_reuse_clients");
      if (!(setting.success && setting.data.value === true)) {
        return { success: false, error: `Code ${code} belongs to a client record. Reusing it is disabled.`, code: "CODE_TAKEN" };
      }
      const { data: updated, error } = await admin.from("organisations").update({ is_supplier: true }).eq("id", existing.id).select(COUNTERPARTY_COLUMNS).single();
      if (error || !updated) return { success: false, error: "Failed to create record", code: "CREATE_FAILED" };
      row = updated;
    } else {
      return { success: false, error: `Code ${code} is already taken by another organisation`, code: "CODE_TAKEN" };
    }
  } else {
    const { data: created, error } = await admin.from("organisations").insert({
      code, name, is_external: book !== "traders", is_active: true,
      ...(book === "clients" ? { is_customer: true } : book === "traders" ? { is_trader: true } : { is_supplier: true }),
      registration_number: nn(input.registrationNumber), vat_number: nn(input.vatNumber),
      legal_address: nn(input.legalAddress), country: nn(input.country)?.toUpperCase() ?? null,
      email: nn(input.email), phone: nn(input.phone), website: nn(input.website),
      bank_name: nn(input.bankName), bank_account_number: nn(input.bankAccountNumber),
      bank_swift_code: nn(input.bankSwiftCode), default_signee_name: nn(input.defaultSigneeName),
      default_signee_role: nn(input.defaultSigneeRole),
    }).select(COUNTERPARTY_COLUMNS).single();
    if (error || !created) {
      return { success: false, error: error?.code === "23505" ? `Code ${code} is already taken` : "Failed to create record", code: error?.code === "23505" ? "CODE_TAKEN" : "CREATE_FAILED" };
    }
    row = created;
  }
  await ensureTradingPartnerLinks(admin, access.callerOrgId, row.id, access.session.id);
  await syncCrm(admin, row);
  await logAudit({ action: "counterparty.create", resourceType: "organisation", resourceId: row.id, organisationId: row.id, metadata: { book, code } });
  return { success: true, data: mapRow(row) };
}

export async function updateCounterparty(
  book: CounterpartyBook,
  id: string,
  input: CounterpartyInput,
): Promise<ActionResult<CounterpartyRow>> {
  const access = await requireCounterpartyRecordAccess(book, id, "manage");
  if (!access.ok) return { success: false, error: "Not found", code: "NOT_FOUND" };
  const name = input.name.trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: updated, error } = await admin.from("organisations").update({
    name, registration_number: nn(input.registrationNumber), vat_number: nn(input.vatNumber),
    legal_address: nn(input.legalAddress), country: nn(input.country)?.toUpperCase() ?? null,
    email: nn(input.email), phone: nn(input.phone), website: nn(input.website),
    bank_name: nn(input.bankName), bank_account_number: nn(input.bankAccountNumber),
    bank_swift_code: nn(input.bankSwiftCode), default_signee_name: nn(input.defaultSigneeName),
    default_signee_role: nn(input.defaultSigneeRole),
    ...(typeof input.isActive === "boolean" ? { is_active: input.isActive } : {}),
  }).eq("id", id).select(COUNTERPARTY_COLUMNS).single();
  if (error || !updated) return { success: false, error: "Failed to update record", code: "UPDATE_FAILED" };
  await syncCrm(admin, updated);
  await logAudit({ action: "counterparty.update", resourceType: "organisation", resourceId: id, organisationId: id, metadata: { book } });
  return { success: true, data: mapRow(updated) };
}

/** Admins hard-delete through the existing blocker-aware action; managers only unlink. */
export async function removeCounterparty(
  book: CounterpartyBook,
  id: string,
): Promise<ActionResult<{ id: string; removed: "deleted" | "unlinked" }>> {
  const access = await requireCounterpartyRecordAccess(book, id, "manage");
  if (!access.ok) return { success: false, error: "Not found", code: "NOT_FOUND" };
  if (access.mode === "admin") {
    const deleted = await deleteOrganisation(id);
    return deleted.success
      ? { success: true, data: { id, removed: "deleted" } }
      : { success: false, error: deleted.error, code: deleted.code };
  }
  if (!access.callerOrgId) return { success: false, error: "Not found", code: "NOT_FOUND" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.from("organisation_trading_partners").delete().or(
    `and(organisation_id.eq.${access.callerOrgId},partner_organisation_id.eq.${id}),and(organisation_id.eq.${id},partner_organisation_id.eq.${access.callerOrgId})`,
  );
  if (error) return { success: false, error: "Failed to remove company", code: "REMOVE_FAILED" };
  await logAudit({ action: "counterparty.unlink", resourceType: "organisation", resourceId: id, organisationId: access.callerOrgId, metadata: { book } });
  return { success: true, data: { id, removed: "unlinked" } };
}
