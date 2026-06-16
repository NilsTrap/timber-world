"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { createOrgSchema, type CreateOrgInput } from "../schemas";
import type { Organisation, ActionResult } from "../types";
import { crmSyncOrg } from "../services/oscarCrm";

/** Trim a value; empty → null (so blank company-card fields store as NULL). */
function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Create Organisation
 *
 * Creates a new organisation with a 3-character code, name and optional
 * company card (legal address, VAT/registration, country, contact, bank).
 * Admin only endpoint.
 */
export async function createOrganisation(
  input: CreateOrgInput
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

  // 3. Validate input with Zod
  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { code, name } = parsed.data;
  const card = parsed.data;
  const supabase = await createClient();

  // 4. Check for duplicate code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("organisations")
    .select("id")
    .eq("code", code)
    .single();

  if (existing) {
    return {
      success: false,
      error: "Organisation code already exists",
      code: "DUPLICATE_CODE",
    };
  }

  // 5. Insert new organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .insert({
      code,
      name,
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
    .select("id, code, name, is_active, is_external, is_customer, is_manufacturer, is_producer, legal_address, vat_number, registration_number, country, phone, email, website, bank_name, bank_account_number, bank_swift_code, logo_url, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create organisation:", error);
    return {
      success: false,
      error: "Failed to create organisation",
      code: "CREATE_FAILED",
    };
  }

  // 6. Transform and return
  const organisation: Organisation = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    isExternal: data.is_external as boolean,
    isCustomer: (data.is_customer as boolean) ?? false,
    isManufacturer: (data.is_manufacturer as boolean) ?? false,
    isProducer: (data.is_producer as boolean) ?? false,
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
    crmOrgId: null,
  });

  return {
    success: true,
    data: organisation,
  };
}
