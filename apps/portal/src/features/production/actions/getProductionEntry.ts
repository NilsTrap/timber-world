"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, EntryType } from "../types";

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
}

/**
 * Fetch a single production entry by ID with joined process name.
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
    .select("id, production_date, status, entry_type, corrects_entry_id, notes, created_at, ref_processes(value, code)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

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
    },
  };
}
