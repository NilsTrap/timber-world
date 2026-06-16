/**
 * Organisation service — `(db, …)`-style shared layer over the `organisations`
 * table for the MCP route (admin client) and any other non-session caller. The
 * session-bound UI actions (createOrganisation/updateOrganisation) keep their own
 * entry points; this mirrors their logic for the agent surface.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { createOrgSchema, type CreateOrgInput } from "../schemas";
import { crmSyncOrg } from "./oscarCrm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

const ORG_SELECT =
  "id, code, name, is_active, is_external, is_customer, is_manufacturer, is_producer, legal_address, vat_number, registration_number, country, phone, email, website, bank_name, bank_account_number, bank_swift_code, crm_org_id, crm_synced_at, created_at, updated_at";

export interface OrgView {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isExternal: boolean;
  isCustomer: boolean;
  isManufacturer: boolean;
  isProducer: boolean;
  legalAddress: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankSwiftCode: string | null;
  crmOrgId: string | null;
  crmSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrg(row: any): OrgView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active ?? true,
    isExternal: row.is_external ?? false,
    isCustomer: row.is_customer ?? false,
    isManufacturer: row.is_manufacturer ?? false,
    isProducer: row.is_producer ?? false,
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
    crmOrgId: row.crm_org_id ?? null,
    crmSyncedAt: row.crm_synced_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cardFromOrg(o: OrgView) {
  return {
    timberOrgId: o.id, code: o.code, name: o.name,
    legalAddress: o.legalAddress, vatNumber: o.vatNumber, registrationNumber: o.registrationNumber,
    country: o.country, phone: o.phone, email: o.email, website: o.website,
    bankName: o.bankName, bankAccountNumber: o.bankAccountNumber, bankSwiftCode: o.bankSwiftCode,
    isCustomer: o.isCustomer, isManufacturer: o.isManufacturer, isProducer: o.isProducer,
  };
}

export async function listOrgs(db: DbClient, opts: { query?: string; limit?: number } = {}): Promise<ActionResult<OrgView[]>> {
  let q = db.from("organisations").select(ORG_SELECT).order("name", { ascending: true });
  if (opts.query) q = q.or(`name.ilike.%${opts.query}%,code.ilike.%${opts.query}%`);
  q = q.limit(Math.min(opts.limit ?? 100, 200));
  const { data, error } = await q;
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  return { success: true, data: (data ?? []).map(mapOrg) };
}

export async function getOrg(db: DbClient, id: string): Promise<ActionResult<OrgView>> {
  if (!isValidUUID(id)) return { success: false, error: "Invalid organisation id", code: "VALIDATION_ERROR" };
  const { data, error } = await db.from("organisations").select(ORG_SELECT).eq("id", id).single();
  if (error || !data) return { success: false, error: error?.message ?? "Organisation not found", code: "NOT_FOUND" };
  return { success: true, data: mapOrg(data) };
}

/** Create an org (admin/service path) + best-effort CRM write-through. */
export async function createOrg(db: DbClient, input: CreateOrgInput): Promise<ActionResult<OrgView>> {
  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" };
  const card = parsed.data;

  const { data: existing } = await db.from("organisations").select("id").eq("code", card.code).maybeSingle();
  if (existing) return { success: false, error: "Organisation code already exists", code: "DUPLICATE_CODE" };

  const { data, error } = await db
    .from("organisations")
    .insert({
      code: card.code,
      name: card.name,
      is_active: true,
      is_external: false,
      legal_address: nn(card.legalAddress),
      vat_number: nn(card.vatNumber),
      registration_number: nn(card.registrationNumber),
      country: nn(card.country)?.toUpperCase() ?? null,
      phone: nn(card.phone),
      email: nn(card.email),
      website: nn(card.website),
      bank_name: nn(card.bankName),
      bank_account_number: nn(card.bankAccountNumber),
      bank_swift_code: nn(card.bankSwiftCode),
    })
    .select(ORG_SELECT)
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create organisation", code: "CREATE_FAILED" };

  const org = mapOrg(data);
  await crmSyncOrg(db, { ...cardFromOrg(org), crmOrgId: null });
  return { success: true, data: org };
}
