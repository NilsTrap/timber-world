"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";

/** A global packaging type assigned to a variant (join row + type details). */
export interface VariantPackaging {
  id: string; // assignment id
  variantId: string;
  packagingTypeId: string;
  name: string;
  piecesPerPackage: number;
  description: string | null;
  priceOverrideCents: number | null;
  isDefault: boolean;
}

function toAssignment(row: any): VariantPackaging {
  const t = row.catalog_packaging_types;
  return {
    id: row.id,
    variantId: row.variant_id,
    packagingTypeId: row.packaging_type_id,
    name: t?.name ?? "",
    piecesPerPackage: t?.pieces_per_package ?? 0,
    description: t?.description ?? null,
    priceOverrideCents: row.price_override_cents,
    isDefault: row.is_default,
  };
}

export async function getVariantPackaging(variantId: string): Promise<ActionResult<VariantPackaging[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_variant_packaging_assignments")
    .select("*, catalog_packaging_types(name, pieces_per_package, description, sort_order)")
    .eq("variant_id", variantId);

  if (error) return { success: false, error: error.message };
  const list = (data || []).map(toAssignment).sort(
    (a: VariantPackaging, b: VariantPackaging) => a.piecesPerPackage - b.piecesPerPackage
  );
  return { success: true, data: list };
}

export interface AssignPackagingInput {
  variantId: string;
  packagingTypeId: string;
  priceOverrideCents?: number | null;
  isDefault?: boolean;
}

export async function assignVariantPackaging(input: AssignPackagingInput): Promise<ActionResult<VariantPackaging>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Only one default per variant.
  if (input.isDefault) {
    await (supabase as any)
      .from("catalog_variant_packaging_assignments")
      .update({ is_default: false })
      .eq("variant_id", input.variantId);
  }

  const { data, error } = await (supabase as any)
    .from("catalog_variant_packaging_assignments")
    .upsert({
      variant_id: input.variantId,
      packaging_type_id: input.packagingTypeId,
      price_override_cents: input.priceOverrideCents ?? null,
      is_default: input.isDefault ?? false,
    }, { onConflict: "variant_id,packaging_type_id" })
    .select("*, catalog_packaging_types(name, pieces_per_package, description, sort_order)")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  return { success: true, data: toAssignment(data) };
}

export async function removeVariantPackaging(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_variant_packaging_assignments").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
