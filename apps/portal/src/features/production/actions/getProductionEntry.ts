"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser } from "@/lib/auth";
import type { ActionResult, EntryType, WorkFormula } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProductionEntryDetail {
  id: string;
  productionDate: string;
  status: "draft" | "validated";
  entryType: EntryType;
  correctsEntryId: string | null;
  notes: string | null;
  createdAt: string;
  processName: string;
  processCode: string;
  workUnit: string | null;
  workFormula: WorkFormula;
  plannedWork: number | null;
  actualWork: number | null;
}

/**
 * Fetch a single production entry by ID with joined process name.
 *
 * Multi-tenancy:
 * - Organisation users can only fetch entries from their own organisation
 * - Super Admin can fetch any entry
 */
export async function getProductionEntry(
  id: string
): Promise<ActionResult<ProductionEntryDetail>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!id || !UUID_REGEX.test(id)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, production_date, status, entry_type, corrects_entry_id, notes, created_at, organisation_id, planned_work, actual_work, ref_processes(value, code, work_unit, work_formula)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Organisation users can only access their own organisation's entries
  if (isOrganisationUser(session) && data.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  // Super Admin can access any entry

  return {
    success: true,
    data: {
      id: data.id,
      productionDate: data.production_date,
      status: data.status,
      entryType: data.entry_type ?? "standard",
      correctsEntryId: data.corrects_entry_id ?? null,
      notes: data.notes,
      createdAt: data.created_at,
      processName: data.ref_processes?.value ?? "Unknown",
      processCode: data.ref_processes?.code ?? "OUT",
      workUnit: data.ref_processes?.work_unit ?? null,
      workFormula: data.ref_processes?.work_formula ?? null,
      plannedWork: data.planned_work ?? null,
      actualWork: data.actual_work ?? null,
    },
  };
}
