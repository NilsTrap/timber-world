"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updateOrgSchema } from "../schemas";
import { isValidUUID } from "../types";
import type { Organisation, ActionResult } from "../types";
import { crmSyncOrg } from "../services/oscarCrm";

/** Trim a value; empty → null (blank company-card fields store as NULL). */
function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Update Organisation
 *
 * Updates an existing organisation's name and optionally code.
 * Admin only endpoint.
 */
export async function updateOrganisation(
  id: string,
  input: {
    name: string;
    code?: string;
    legalAddress?: string | null;
    vatNumber?: string | null;
    registrationNumber?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankSwiftCode?: string | null;
  }
): Promise<ActionResult<Organisation>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate organisation ID
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
  }

  // 4. Validate input with Zod
  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name, code: newCode } = parsed.data;
  const supabase = await createClient();

  // 5. Update organisation
  const updatePayload: Record<string, unknown> = { name };
  if (newCode) {
    updatePayload.code = newCode;
  }
  // Normalise blank/whitespace company-card fields to NULL (mirrors
  // createOrganisation's nn()); country upper-cased to ISO-2 so VAT rules + the
  // CRM `country` field stay consistent across create + edit.
  if ("legalAddress" in input) {
    updatePayload.legal_address = nn(input.legalAddress);
  }
  if ("vatNumber" in input) {
    updatePayload.vat_number = nn(input.vatNumber);
  }
  if ("registrationNumber" in input) {
    updatePayload.registration_number = nn(input.registrationNumber);
  }
  if ("country" in input) {
    updatePayload.country = nn(input.country)?.toUpperCase() ?? null;
  }
  if ("phone" in input) {
    updatePayload.phone = nn(input.phone);
  }
  if ("email" in input) {
    updatePayload.email = nn(input.email);
  }
  if ("website" in input) {
    updatePayload.website = nn(input.website);
  }
  if ("bankName" in input) {
    updatePayload.bank_name = nn(input.bankName);
  }
  if ("bankAccountNumber" in input) {
    updatePayload.bank_account_number = nn(input.bankAccountNumber);
  }
  if ("bankSwiftCode" in input) {
    updatePayload.bank_swift_code = nn(input.bankSwiftCode);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .update(updatePayload)
    .eq("id", id)
    .select("id, code, name, is_active, is_external, is_customer, is_manufacturer, is_producer, legal_address, vat_number, registration_number, country, phone, email, website, bank_name, bank_account_number, bank_swift_code, logo_url, crm_org_id, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to update organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation",
      code: "UPDATE_FAILED",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Organisation not found",
      code: "NOT_FOUND",
    };
  }

  // 6. Transform and return
  const organisation: Organisation = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    isExternal: data.is_external as boolean,
    isCustomer: data.is_customer as boolean,
    isManufacturer: data.is_manufacturer as boolean,
    isProducer: data.is_producer as boolean,
    legalAddress: (data.legal_address as string | null) ?? null,
    vatNumber: (data.vat_number as string | null) ?? null,
    registrationNumber: (data.registration_number as string | null) ?? null,
    country: (data.country as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    bankName: (data.bank_name as string | null) ?? null,
    bankAccountNumber: (data.bank_account_number as string | null) ?? null,
    bankSwiftCode: (data.bank_swift_code as string | null) ?? null,
    logoUrl: (data.logo_url as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  // Write-through to the Oscar CRM (best-effort; no-op until configured).
  await crmSyncOrg(supabase, {
    timberOrgId: organisation.id,
    code: organisation.code,
    name: organisation.name,
    legalAddress: organisation.legalAddress,
    vatNumber: organisation.vatNumber,
    registrationNumber: organisation.registrationNumber,
    country: organisation.country,
    phone: organisation.phone,
    email: organisation.email,
    website: organisation.website,
    bankName: organisation.bankName,
    bankAccountNumber: organisation.bankAccountNumber,
    bankSwiftCode: organisation.bankSwiftCode,
    isCustomer: organisation.isCustomer,
    isManufacturer: organisation.isManufacturer,
    isProducer: organisation.isProducer,
    crmOrgId: (data.crm_org_id as string | null) ?? null,
  });

  return {
    success: true,
    data: organisation,
  };
}
