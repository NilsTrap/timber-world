"use server";

import { createCrmClient } from "../lib/supabase";
import { revalidatePath } from "next/cache";
import type { CrmCompany, CrmContact, CompanyStatus } from "../types";

/**
 * Create a new company
 */
export async function createCompany(
  company: Partial<CrmCompany>
): Promise<{ success: true; data: CrmCompany } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_companies")
    .insert({
      name: company.name,
      registration_number: company.registration_number,
      website: company.website,
      country: company.country,
      city: company.city,
      address: company.address,
      postal_code: company.postal_code,
      founded_year: company.founded_year,
      employees: company.employees,
      turnover_eur: company.turnover_eur,
      industry: company.industry,
      industry_codes: company.industry_codes,
      email: company.email,
      phone: company.phone,
      source: company.source,
      source_url: company.source_url,
      notes: company.notes,
      status: company.status || "new",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating company:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true, data: data as CrmCompany };
}

/**
 * Update an existing company
 */
export async function updateCompany(
  id: string,
  updates: Partial<CrmCompany>
): Promise<{ success: true; data: CrmCompany } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_companies")
    .update({
      name: updates.name,
      registration_number: updates.registration_number,
      website: updates.website,
      country: updates.country,
      city: updates.city,
      address: updates.address,
      postal_code: updates.postal_code,
      founded_year: updates.founded_year,
      employees: updates.employees,
      turnover_eur: updates.turnover_eur,
      industry: updates.industry,
      industry_codes: updates.industry_codes,
      email: updates.email,
      phone: updates.phone,
      source: updates.source,
      source_url: updates.source_url,
      notes: updates.notes,
      status: updates.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating company:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${id}`);
  return { success: true, data: data as CrmCompany };
}

/**
 * Update company status
 */
export async function updateCompanyStatus(
  id: string,
  status: CompanyStatus
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { error } = await supabase
    .from("crm_companies")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating company status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Delete a company
 */
export async function deleteCompany(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { error } = await supabase
    .from("crm_companies")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting company:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Create a contact for a company
 */
export async function createContact(
  contact: Partial<CrmContact>
): Promise<{ success: true; data: CrmContact } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      company_id: contact.company_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      position: contact.position,
      email: contact.email,
      phone: contact.phone,
      linkedin_url: contact.linkedin_url,
      source: contact.source,
      consent_status: contact.consent_status || "pending",
      do_not_contact: contact.do_not_contact || false,
      deletion_requested: contact.deletion_requested || false,
      notes: contact.notes,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating contact:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  if (contact.company_id) {
    revalidatePath(`/admin/crm/${contact.company_id}`);
  }
  return { success: true, data: data as CrmContact };
}

/**
 * Update a contact
 */
export async function updateContact(
  id: string,
  updates: Partial<CrmContact>
): Promise<{ success: true; data: CrmContact } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_contacts")
    .update({
      first_name: updates.first_name,
      last_name: updates.last_name,
      position: updates.position,
      email: updates.email,
      phone: updates.phone,
      linkedin_url: updates.linkedin_url,
      source: updates.source,
      consent_status: updates.consent_status,
      do_not_contact: updates.do_not_contact,
      notes: updates.notes,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating contact:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true, data: data as CrmContact };
}

/**
 * Delete a contact
 */
export async function deleteContact(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { error } = await supabase
    .from("crm_contacts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting contact:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Handle GDPR unsubscribe request
 */
export async function unsubscribeContact(
  id: string,
  reason?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { error } = await supabase
    .from("crm_contacts")
    .update({
      consent_status: "unsubscribed",
      unsubscribe_date: new Date().toISOString(),
      unsubscribe_reason: reason,
      do_not_contact: true,
    })
    .eq("id", id);

  if (error) {
    console.error("Error unsubscribing contact:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Handle GDPR deletion request
 */
export async function requestContactDeletion(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createCrmClient();

  const { error } = await supabase
    .from("crm_contacts")
    .update({
      deletion_requested: true,
      data_request_date: new Date().toISOString(),
      do_not_contact: true,
    })
    .eq("id", id);

  if (error) {
    console.error("Error requesting contact deletion:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}
