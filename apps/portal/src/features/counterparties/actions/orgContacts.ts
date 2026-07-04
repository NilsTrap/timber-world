"use server";

/**
 * K1 · CRM contacts (org_contacts) — named people attached to a counterparty
 * organisation, plus the "primary" contact and a "use as signee" shortcut that
 * writes organisations.default_signee_* (G3) so documents pick it up.
 *
 * GATING: contacts inherit the org's address-book wall. We derive which book(s)
 * an org belongs to from its role flags (clients=is_customer,
 * suppliers=is_supplier OR is_producer, traders=is_trader) and require the
 * caller to pass requireBookAccess for at least one of them. Platform admins
 * pass for ANY org (incl. trader orgs and orgs in no book) — needed for the
 * admin org-detail read-only contacts view. A salesperson (clients access) is
 * therefore refused on a supplier-only org (its only book is "suppliers").
 *
 * DATA ACCESS NOTE: after the gate, reads/writes go through createAdminClient()
 * (service role, bypasses RLS) — the SAME deliberate pattern as counterparties.ts.
 * The action-level gate IS the wall; do not "fix" this to the user client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin } from "@/lib/auth";
import { requireBookAccess, type BookAccess } from "../access";
import type { ActionResult, CounterpartyBook } from "../types";
import type { OrgContactRow, OrgContactInput } from "../contactTypes";

const CONTACT_COLUMNS =
  "id, organisation_id, name, role_title, email, phone, notes, is_primary, is_active";

/** Trim a value; empty → null. */
function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContact(row: any): OrgContactRow {
  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    name: row.name as string,
    roleTitle: (row.role_title as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isPrimary: row.is_primary === true,
    isActive: row.is_active === true,
  };
}

/**
 * Gate contact access by the org's address book(s). Admins pass for any org;
 * others must hold access to at least one book the org belongs to.
 */
async function requireContactAccessForOrg(organisationId: string): Promise<BookAccess> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  // Read the org's role flags to decide which book(s) gate its contacts. This
  // is server-side gate logic (not user-facing data), so the service-role read
  // is fine even before the right check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: org, error } = await admin
    .from("organisations")
    .select("id, is_customer, is_supplier, is_producer, is_trader")
    .eq("id", organisationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load org for contact access check:", error);
    return { ok: false, error: "Failed to check access", code: "ACCESS_CHECK_FAILED" };
  }
  if (!org) return { ok: false, error: "Organisation not found", code: "NOT_FOUND" };

  // Admins pass for any org — incl. trader orgs and orgs in no book.
  if (isAdmin(session)) {
    return {
      ok: true,
      session,
      callerOrgId: session.currentOrganizationId || session.organisationId,
    };
  }

  // Derive the books this org belongs to (same predicate as counterparties'
  // isInBook) and require access to at least one.
  const books: CounterpartyBook[] = [];
  if (org.is_customer === true) books.push("clients");
  if (org.is_supplier === true || org.is_producer === true) books.push("suppliers");
  if (org.is_trader === true) books.push("traders");

  for (const book of books) {
    const g = await requireBookAccess(book);
    if (g.ok) return g;
  }
  return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
}

/**
 * All contacts for one org, primary-first then newest-first. Active only by
 * default; pass includeInactive to also return archived contacts.
 * (R9 reuses this — keep the signature stable.)
 */
export async function listOrgContacts(
  organisationId: string,
  opts?: { includeInactive?: boolean },
): Promise<ActionResult<OrgContactRow[]>> {
  const g = await requireContactAccessForOrg(organisationId);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let query = admin
    .from("org_contacts")
    .select(CONTACT_COLUMNS)
    .eq("organisation_id", organisationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (!opts?.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to list org contacts:", error);
    return { success: false, error: "Failed to load contacts", code: "FETCH_FAILED" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, data: ((data || []) as any[]).map(mapContact) };
}

/**
 * Create a contact under an org. (R9 quick-add reuses this.) An explicit
 * isPrimary clears the current primary first so the new row wins (the DB
 * trigger would otherwise force a 2nd primary to false).
 */
export async function createOrgContact(
  organisationId: string,
  input: OrgContactInput,
): Promise<ActionResult<OrgContactRow>> {
  const g = await requireContactAccessForOrg(organisationId);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const name = (input.name ?? "").trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  if (input.isPrimary === true) {
    await admin
      .from("org_contacts")
      .update({ is_primary: false })
      .eq("organisation_id", organisationId)
      .eq("is_primary", true);
  }

  const { data, error } = await admin
    .from("org_contacts")
    .insert({
      organisation_id: organisationId,
      name,
      role_title: nn(input.roleTitle),
      email: nn(input.email),
      phone: nn(input.phone),
      notes: nn(input.notes),
      is_primary: input.isPrimary === true,
      is_active: input.isActive !== false,
    })
    .select(CONTACT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("Failed to create org contact:", error);
    return { success: false, error: "Failed to create contact", code: "CREATE_FAILED" };
  }
  return { success: true, data: mapContact(data) };
}

/**
 * Edit a contact's card fields and toggle is_active. Does NOT touch is_primary
 * (that is managed by setPrimaryContact). Gated by the contact's org.
 */
export async function updateOrgContact(
  id: string,
  patch: OrgContactInput,
): Promise<ActionResult<OrgContactRow>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: existing, error: loadErr } = await admin
    .from("org_contacts")
    .select("id, organisation_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    console.error("Failed to load contact for update:", loadErr);
    return { success: false, error: "Failed to update contact", code: "UPDATE_FAILED" };
  }
  if (!existing) return { success: false, error: "Contact not found", code: "NOT_FOUND" };

  const g = await requireContactAccessForOrg(existing.organisation_id);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const name = (patch.name ?? "").trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };

  const { data, error } = await admin
    .from("org_contacts")
    .update({
      name,
      role_title: nn(patch.roleTitle),
      email: nn(patch.email),
      phone: nn(patch.phone),
      notes: nn(patch.notes),
      ...(typeof patch.isActive === "boolean" ? { is_active: patch.isActive } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CONTACT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("Failed to update org contact:", error);
    return { success: false, error: "Failed to update contact", code: "UPDATE_FAILED" };
  }
  return { success: true, data: mapContact(data) };
}

/** Hard-delete a contact (confirm in the UI). Gated by the contact's org. */
export async function deleteOrgContact(id: string): Promise<ActionResult<{ id: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: existing } = await admin
    .from("org_contacts")
    .select("id, organisation_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "Contact not found", code: "NOT_FOUND" };

  const g = await requireContactAccessForOrg(existing.organisation_id);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const { error } = await admin.from("org_contacts").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete org contact:", error);
    return { success: false, error: "Failed to delete contact", code: "DELETE_FAILED" };
  }
  return { success: true, data: { id } };
}

/**
 * Promote a contact to primary. Clears the org's current primary first, then
 * sets this one (the first-wins trigger needs no other primary present for the
 * set to stick). Gated by the contact's org.
 */
export async function setPrimaryContact(id: string): Promise<ActionResult<OrgContactRow>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: existing } = await admin
    .from("org_contacts")
    .select("id, organisation_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "Contact not found", code: "NOT_FOUND" };

  const g = await requireContactAccessForOrg(existing.organisation_id);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  await admin
    .from("org_contacts")
    .update({ is_primary: false })
    .eq("organisation_id", existing.organisation_id)
    .eq("is_primary", true)
    .neq("id", id);

  const { data, error } = await admin
    .from("org_contacts")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(CONTACT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("Failed to set primary contact:", error);
    return { success: false, error: "Failed to set primary contact", code: "UPDATE_FAILED" };
  }
  return { success: true, data: mapContact(data) };
}

/**
 * Copy a contact's name/role into organisations.default_signee_* (G3) so
 * generated documents default to this signee. Gated by the org.
 */
export async function useContactAsSignee(
  organisationId: string,
  contactId: string,
): Promise<ActionResult<{ signeeName: string; signeeRole: string | null }>> {
  const g = await requireContactAccessForOrg(organisationId);
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: contact } = await admin
    .from("org_contacts")
    .select("id, organisation_id, name, role_title")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact || contact.organisation_id !== organisationId) {
    return { success: false, error: "Contact not found", code: "NOT_FOUND" };
  }

  const signeeRole = (contact.role_title as string | null) ?? null;
  const { error } = await admin
    .from("organisations")
    .update({ default_signee_name: contact.name, default_signee_role: signeeRole })
    .eq("id", organisationId);
  if (error) {
    console.error("Failed to set default signee from contact:", error);
    return { success: false, error: "Failed to set signee", code: "UPDATE_FAILED" };
  }
  return { success: true, data: { signeeName: contact.name as string, signeeRole } };
}
