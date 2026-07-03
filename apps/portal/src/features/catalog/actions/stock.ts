"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";

/** One stock line for a variant — a quantity held in a given packaging form. */
export interface VariantStockEntry {
  id: string;
  variantId: string;
  packagingTypeId: string | null; // null = loose pieces
  packagingName: string | null;
  piecesPerPackage: number | null; // null for loose
  quantity: number; // number of packages (or loose pieces)
  pieces: number; // computed total pieces this line represents
}

export interface VariantStockSummary {
  entries: VariantStockEntry[];
  totalPieces: number;
}

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

function rowToEntry(row: any): VariantStockEntry {
  const ppp = row.catalog_packaging_types?.pieces_per_package ?? null;
  const qty = Number(row.quantity) || 0;
  const pieces = ppp != null ? qty * Number(ppp) : qty; // loose → quantity is already pieces
  return {
    id: row.id,
    variantId: row.variant_id,
    packagingTypeId: row.packaging_type_id,
    packagingName: row.catalog_packaging_types?.name ?? null,
    piecesPerPackage: ppp != null ? Number(ppp) : null,
    quantity: qty,
    pieces,
  };
}

export async function getVariantStock(variantId: string): Promise<ActionResult<VariantStockSummary>> {
  const gate = await assertCatalogueAccess();
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_variant_stock")
    .select("id, variant_id, packaging_type_id, quantity, catalog_packaging_types(name, pieces_per_package)")
    .eq("variant_id", variantId);
  if (error) return { success: false, error: error.message };

  const entries = (data ?? []).map(rowToEntry).sort((a: VariantStockEntry, b: VariantStockEntry) => {
    // loose last, otherwise by packaging name
    if (a.packagingTypeId == null) return 1;
    if (b.packagingTypeId == null) return -1;
    return (a.packagingName ?? "").localeCompare(b.packagingName ?? "");
  });
  const totalPieces = entries.reduce((s: number, e: VariantStockEntry) => s + e.pieces, 0);
  return { success: true, data: { entries, totalPieces } };
}

/** Create or update a variant's stock quantity for a packaging form (null = loose). */
export async function saveVariantStockEntry(input: {
  variantId: string;
  packagingTypeId: string | null;
  quantity: number;
}): Promise<ActionResult<null>> {
  const gate = await assertCatalogueAccess();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    return { success: false, error: "Quantity must be zero or more." };
  }

  const supabase = await createClient();
  // Find an existing line for this (variant, packaging form) — null-safe.
  let q = (supabase as any)
    .from("catalog_variant_stock")
    .select("id")
    .eq("variant_id", input.variantId);
  q = input.packagingTypeId == null ? q.is("packaging_type_id", null) : q.eq("packaging_type_id", input.packagingTypeId);
  const { data: existing } = await q.maybeSingle();

  if (existing?.id) {
    const { error } = await (supabase as any)
      .from("catalog_variant_stock")
      .update({ quantity: input.quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await (supabase as any)
      .from("catalog_variant_stock")
      .insert({ variant_id: input.variantId, packaging_type_id: input.packagingTypeId, quantity: input.quantity });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}

export async function deleteVariantStockEntry(id: string): Promise<ActionResult<null>> {
  const gate = await assertCatalogueAccess();
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_variant_stock").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
