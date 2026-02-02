"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

interface SaveProcessNoteInput {
  processId: string;
  notes: string;
  organizationId?: string;
}

/**
 * Save or update a process note for an organization.
 * Uses upsert to handle both create and update cases.
 */
export async function saveProcessNote(
  input: SaveProcessNoteInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  // Determine organization ID
  const orgId = input.organizationId || session.organisationId;
  if (!orgId) {
    return { success: false, error: "No organization context" };
  }

  // Verify user has access to this organization
  if (orgId !== session.organisationId && !isSuperAdmin(session)) {
    return { success: false, error: "Access denied" };
  }

  // Upsert the note (insert if not exists, update if exists)
  const { data, error } = await (supabase as any)
    .from("organization_process_notes")
    .upsert(
      {
        organization_id: orgId,
        process_id: input.processId,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,process_id",
      }
    )
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { id: data.id } };
}
