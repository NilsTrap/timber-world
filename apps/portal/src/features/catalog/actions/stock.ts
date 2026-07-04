"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";
import {
  getVariantStock as getVariantStockService,
  saveVariantStockEntry as saveVariantStockEntryService,
  deleteVariantStockEntry as deleteVariantStockEntryService,
  type VariantStockEntry,
  type VariantStockSummary,
} from "../services/stock";

// Re-export the stock types from their new service home (back-compat for existing
// UI imports from this action module).
export type { VariantStockEntry, VariantStockSummary };

async function assertCatalogueAccess() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Not authenticated" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { ok: false as const, error: "Permission denied" };
  }
  return { ok: true as const };
}

export async function getVariantStock(variantId: string): Promise<ActionResult<VariantStockSummary>> {
  try {
    const gate = await assertCatalogueAccess();
    if (!gate.ok) return { success: false, error: gate.error };
    const supabase = await createClient();
    return await getVariantStockService(supabase, variantId);
  } catch (e) {
    // Never let a mount-time read reject at the server-action boundary (that
    // surfaces as a masked "Server Components render" error and can break the
    // page). Always hand back a graceful result the UI can render inline.
    return { success: false, error: e instanceof Error ? e.message : "Failed to load stock" };
  }
}

/** Create or update a variant's stock quantity for a packaging form (null = loose). */
export async function saveVariantStockEntry(input: {
  variantId: string;
  packagingTypeId: string | null;
  quantity: number;
}): Promise<ActionResult<null>> {
  const gate = await assertCatalogueAccess();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createClient();
  const res = await saveVariantStockEntryService(supabase, input);
  if (res.success) revalidatePath("/admin/catalog");
  return res;
}

export async function deleteVariantStockEntry(id: string): Promise<ActionResult<null>> {
  const gate = await assertCatalogueAccess();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createClient();
  const res = await deleteVariantStockEntryService(supabase, id);
  if (res.success) revalidatePath("/admin/catalog");
  return res;
}
