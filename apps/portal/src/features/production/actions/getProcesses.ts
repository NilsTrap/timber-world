"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getOrgExcludedRefValues } from "@/lib/auth/getOrgRefExclusions";
import type { Process, ProcessWithNotes, ActionResult } from "../types";

/**
 * Fetch all active processes ordered by sort_order.
 * Filters out processes excluded for the user's organisation.
 * Used by the production form's process dropdown.
 */
export async function getProcesses(): Promise<ActionResult<Process[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();
  const orgId = session.currentOrganizationId || session.organisationId || null;

  // Fire the processes query and the org-exclusions lookup in parallel —
  // both depend only on orgId, no data dependency between them.
  const [{ data, error }, exclusions] = await Promise.all([
    (supabase as any)
      .from("ref_processes")
      .select("id, code, value, sort_order, work_unit, work_formula, price, pallet_price")
      .eq("is_active", true)
      .order("value", { ascending: true }),
    getOrgExcludedRefValues(orgId),
  ]);

  if (error) {
    return { success: false, error: error.message };
  }

  const excludedProcesses = exclusions.get("ref_processes");

  const processes: Process[] = (data ?? [])
    .filter((row: any) => !excludedProcesses || !excludedProcesses.has(row.id))
    .map((row: any) => ({
      id: row.id,
      code: row.code,
      value: row.value,
      sortOrder: row.sort_order,
      workUnit: row.work_unit,
      workFormula: row.work_formula ?? null,
      price: row.price != null ? Number(row.price) : null,
      palletPrice: row.pallet_price != null ? Number(row.pallet_price) : null,
    }));

  return { success: true, data: processes };
}

/**
 * Fetch all active processes with organization-specific notes.
 * Used by the Process List tab to display and edit process descriptions.
 */
export async function getProcessesWithNotes(
  organizationId?: string
): Promise<ActionResult<ProcessWithNotes[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  // Determine which organization's notes to fetch
  const orgId = organizationId || session.organisationId;
  if (!orgId && !isSuperAdmin(session)) {
    return { success: false, error: "No organization context" };
  }

  // Fire the three independent fetches in parallel: processes list,
  // org-scoped notes, and the exclusions map all only depend on orgId.
  const processesPromise = (supabase as any)
    .from("ref_processes")
    .select("id, code, value, sort_order, work_unit, work_formula, price, pallet_price")
    .eq("is_active", true)
    .order("value", { ascending: true });

  const notesPromise = orgId
    ? (supabase as any)
        .from("organization_process_notes")
        .select("id, process_id, notes")
        .eq("organization_id", orgId)
    : Promise.resolve({ data: [] as Array<{ id: string; process_id: string; notes: string }>, error: null });

  const exclusionsPromise = getOrgExcludedRefValues(orgId || null);

  const [
    { data: processesData, error: processesError },
    { data: notesData, error: notesError },
    exclusions,
  ] = await Promise.all([processesPromise, notesPromise, exclusionsPromise]);

  if (processesError) {
    return { success: false, error: processesError.message };
  }
  if (notesError) {
    return { success: false, error: notesError.message };
  }

  const notesMap = new Map<string, { id: string; notes: string }>();
  for (const note of (notesData ?? []) as Array<{ id: string; process_id: string; notes: string }>) {
    notesMap.set(note.process_id, { id: note.id, notes: note.notes });
  }

  const excludedProcesses = exclusions.get("ref_processes");
  const filteredProcesses = excludedProcesses
    ? (processesData ?? []).filter((row: any) => !excludedProcesses.has(row.id))
    : (processesData ?? []);

  // Combine processes with notes
  const processesWithNotes: ProcessWithNotes[] = filteredProcesses.map((row: any) => {
    const noteData = notesMap.get(row.id);
    return {
      id: row.id,
      code: row.code,
      value: row.value,
      sortOrder: row.sort_order,
      workUnit: row.work_unit,
      workFormula: row.work_formula ?? null,
      price: row.price != null ? Number(row.price) : null,
      palletPrice: row.pallet_price != null ? Number(row.pallet_price) : null,
      notes: noteData?.notes ?? "",
      noteId: noteData?.id ?? null,
    };
  });

  return { success: true, data: processesWithNotes };
}
