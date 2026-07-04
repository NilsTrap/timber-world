"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getOptions } from "@/features/catalog/services/attributes";
import type { ActionResult } from "../types";

export interface FieldOptionChoice {
  value: string;
  label: string;
}

/**
 * H2 · Read the ACTIVE options of a global "select" field by its key, for a
 * plain dropdown (e.g. the deal-terms Incoterms picker). This is the non-admin
 * read path: catalog_field_options is authenticated-readable by RLS, so a
 * Salesperson/Purchasing deal-terms editor (not an admin) can populate the
 * dropdown. Admins manage the option set itself in Settings → Fields — this
 * action never writes. Unknown key → empty list (the editor falls back to text).
 */
export async function getFieldOptions(fieldKey: string): Promise<ActionResult<FieldOptionChoice[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  const supabase = await createClient();
  const res = await getOptions(supabase, fieldKey);
  if (!res.success) {
    // A not-yet-seeded field is not an error for the caller — just no options.
    if (res.code === "NOT_FOUND") return { success: true, data: [] };
    return { success: false, error: res.error, code: res.code };
  }
  return { success: true, data: res.data.map((o) => ({ value: o.value, label: o.label })) };
}
