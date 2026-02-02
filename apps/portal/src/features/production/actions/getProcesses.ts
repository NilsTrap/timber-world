"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { Process, ProcessWithNotes, ActionResult } from "../types";

/**
 * Fetch all active processes ordered by sort_order.
 * Used by the production form's process dropdown.
 */
export async function getProcesses(): Promise<ActionResult<Process[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("ref_processes")
    .select("id, code, value, sort_order")
    .eq("is_active", true)
    .order("value", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  const processes: Process[] = (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    value: row.value,
    sortOrder: row.sort_order,
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

  // Fetch all active processes
  const { data: processesData, error: processesError } = await (supabase as any)
    .from("ref_processes")
    .select("id, code, value, sort_order")
    .eq("is_active", true)
    .order("value", { ascending: true });

  if (processesError) {
    return { success: false, error: processesError.message };
  }

  // Fetch notes for the organization (if orgId is available)
  let notesMap = new Map<string, { id: string; notes: string }>();

  if (orgId) {
    const { data: notesData, error: notesError } = await (supabase as any)
      .from("organization_process_notes")
      .select("id, process_id, notes")
      .eq("organization_id", orgId);

    if (notesError) {
      return { success: false, error: notesError.message };
    }

    for (const note of notesData ?? []) {
      notesMap.set(note.process_id, { id: note.id, notes: note.notes });
    }
  }

  // Combine processes with notes
  const processesWithNotes: ProcessWithNotes[] = (processesData ?? []).map((row: any) => {
    const noteData = notesMap.get(row.id);
    return {
      id: row.id,
      code: row.code,
      value: row.value,
      sortOrder: row.sort_order,
      notes: noteData?.notes ?? "",
      noteId: noteData?.id ?? null,
    };
  });

  return { success: true, data: processesWithNotes };
}
