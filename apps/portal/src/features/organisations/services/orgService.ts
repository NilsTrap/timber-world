/**
 * Organisation service — `(db, …)`-style shared layer over the `organisations`
 * table for the MCP route (admin client) and any other non-session caller. The
 * session-bound UI actions (createOrganisation/updateOrganisation) keep their own
 * entry points; this mirrors their logic for the agent surface.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { createOrgSchema, updateOrgCardSchema, type CreateOrgInput, type UpdateOrgCardInput } from "../schemas";
import { crmSyncOrg } from "./oscarCrm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

const ORG_SELECT =
  "id, code, name, is_active, is_external, is_customer, is_manufacturer, is_producer, is_supplier, is_trader, default_signee_name, default_signee_role, legal_address, vat_number, registration_number, country, phone, email, website, bank_name, bank_account_number, bank_swift_code, crm_org_id, crm_synced_at, created_at, updated_at";

export interface OrgView {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isExternal: boolean;
  isCustomer: boolean;
  isManufacturer: boolean;
  isProducer: boolean;
  isSupplier: boolean;
  isTrader: boolean;
  defaultSigneeName: string | null;
  defaultSigneeRole: string | null;
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
    isSupplier: row.is_supplier ?? false,
    isTrader: row.is_trader ?? false,
    defaultSigneeName: row.default_signee_name ?? null,
    defaultSigneeRole: row.default_signee_role ?? null,
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
  // Strip PostgREST reserved chars before interpolating into the .or() filter
  // (the read-only MCP token can reach this — don't let a query inject filters).
  const safe = (opts.query ?? "").replace(/[,()*\\]/g, " ").trim();
  if (safe) q = q.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
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

  // Idempotent for the agent/MCP path: a retried intake with the same code returns
  // the existing org (not an error), so re-running an Oscar workflow is safe. We
  // return it as-is rather than overwriting, to avoid clobbering curated data.
  const { data: existing } = await db.from("organisations").select("id").eq("code", card.code).maybeSingle();
  if (existing?.id) return getOrg(db, existing.id as string);

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
  // Write-through to the Oscar CRM (best-effort); reflect the stored id in the return.
  const crmId = await crmSyncOrg(db, { ...cardFromOrg(org), crmOrgId: null });
  if (crmId) org.crmOrgId = crmId;
  return { success: true, data: org };
}

/** Role/status booleans settable on an org (the org-detail "Roles" toggle set). */
export interface UpdateOrgFlags {
  isCustomer?: boolean;
  isManufacturer?: boolean;
  isProducer?: boolean;
  isSupplier?: boolean;
  isTrader?: boolean;
  isActive?: boolean;
}

/**
 * Partial-update an org (admin/service path) + best-effort CRM write-through —
 * the `(db, …)` twin of the session-bound `updateOrganisation`/`setOrganisationRole`
 * UI actions (one service, no logic duplication). Only PROVIDED fields change.
 *
 * - `code` is IMMUTABLE (deal codes embed it) → a code change is rejected.
 * - Role flags reuse the same columns the Roles toggle writes (is_customer/
 *   is_manufacturer/is_producer/is_supplier) + is_active — booleans, never
 *   interpolated. `is_supplier` drives the Suppliers book.
 * - Signee defaults (default_signee_name/role, G3) feed document signature blocks.
 * - CRM mirror routes to crm_update_organization (the org's existing crm_org_id is
 *   passed through) — consistent with createOrg's create mirror. is_supplier + the
 *   signee fields stay Timber-local (not in the CRM card contract).
 */
export async function updateOrg(
  db: DbClient,
  id: string,
  input: UpdateOrgCardInput & UpdateOrgFlags & { code?: string },
): Promise<ActionResult<OrgView>> {
  if (!isValidUUID(id)) return { success: false, error: "Invalid organisation id", code: "VALIDATION_ERROR" };
  if (input.code !== undefined) {
    return { success: false, error: "Organisation code is immutable (deal codes embed it) and cannot be changed", code: "VALIDATION_ERROR" };
  }
  // Validate the card/string fields; unknown keys (the flags) are stripped by Zod.
  const parsed = updateOrgCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" };
  const card = parsed.data;

  // Confirm the org exists (and grab its CRM id for the mirror routing).
  const { data: existing, error: exErr } = await db.from("organisations").select("id, crm_org_id").eq("id", id).maybeSingle();
  if (exErr) return { success: false, error: exErr.message, code: "FETCH_FAILED" };
  if (!existing) return { success: false, error: "Organisation not found", code: "NOT_FOUND" };

  const u: Record<string, unknown> = {};
  if (card.name !== undefined) u.name = card.name;
  if (card.legalAddress !== undefined) u.legal_address = nn(card.legalAddress);
  if (card.vatNumber !== undefined) u.vat_number = nn(card.vatNumber);
  if (card.registrationNumber !== undefined) u.registration_number = nn(card.registrationNumber);
  if (card.country !== undefined) u.country = nn(card.country)?.toUpperCase() ?? null;
  if (card.phone !== undefined) u.phone = nn(card.phone);
  if (card.email !== undefined) u.email = nn(card.email);
  if (card.website !== undefined) u.website = nn(card.website);
  if (card.bankName !== undefined) u.bank_name = nn(card.bankName);
  if (card.bankAccountNumber !== undefined) u.bank_account_number = nn(card.bankAccountNumber);
  if (card.bankSwiftCode !== undefined) u.bank_swift_code = nn(card.bankSwiftCode);
  if (card.defaultSigneeName !== undefined) u.default_signee_name = nn(card.defaultSigneeName);
  if (card.defaultSigneeRole !== undefined) u.default_signee_role = nn(card.defaultSigneeRole);
  if (typeof input.isCustomer === "boolean") u.is_customer = input.isCustomer;
  if (typeof input.isManufacturer === "boolean") u.is_manufacturer = input.isManufacturer;
  if (typeof input.isProducer === "boolean") u.is_producer = input.isProducer;
  if (typeof input.isSupplier === "boolean") u.is_supplier = input.isSupplier;
  if (typeof input.isTrader === "boolean") u.is_trader = input.isTrader;
  if (typeof input.isActive === "boolean") u.is_active = input.isActive;

  // Nothing to change → idempotent no-op, return the org as-is.
  if (Object.keys(u).length === 0) return getOrg(db, id);

  const { data, error } = await db.from("organisations").update(u).eq("id", id).select(ORG_SELECT).single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to update organisation", code: "UPDATE_FAILED" };

  const org = mapOrg(data);
  const crmId = await crmSyncOrg(db, { ...cardFromOrg(org), crmOrgId: (existing.crm_org_id as string | null) ?? null });
  if (crmId) org.crmOrgId = crmId;
  return { success: true, data: org };
}
