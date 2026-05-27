"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";

export interface VariantPackage {
  id: string;
  variantId: string;
  name: string;
  piecesPerPackage: number;
  volumeM3: number | null;
  areaM2: number | null;
  weightKg: number | null;
  packagePriceCents: number | null;
  isDefault: boolean;
  sortOrder: number;
}

function toPackage(row: any): VariantPackage {
  return {
    id: row.id,
    variantId: row.variant_id,
    name: row.name,
    piecesPerPackage: row.pieces_per_package,
    volumeM3: row.volume_m3,
    areaM2: row.area_m2,
    weightKg: row.weight_kg,
    packagePriceCents: row.package_price_cents,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
  };
}

export async function getVariantPackages(variantId: string): Promise<ActionResult<VariantPackage[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_variant_packages")
    .select("*")
    .eq("variant_id", variantId)
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toPackage) };
}

export interface SavePackageInput {
  id?: string;
  variantId: string;
  name: string;
  piecesPerPackage: number;
  volumeM3?: number | null;
  areaM2?: number | null;
  weightKg?: number | null;
  packagePriceCents?: number | null;
  isDefault?: boolean;
}

export async function saveVariantPackage(input: SavePackageInput): Promise<ActionResult<VariantPackage>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const payload = {
    variant_id: input.variantId,
    name: input.name,
    pieces_per_package: input.piecesPerPackage,
    volume_m3: input.volumeM3 ?? null,
    area_m2: input.areaM2 ?? null,
    weight_kg: input.weightKg ?? null,
    package_price_cents: input.packagePriceCents ?? null,
    is_default: input.isDefault ?? false,
  };

  let result;
  if (input.id) {
    result = await (supabase as any).from("catalog_variant_packages").update(payload).eq("id", input.id).select().single();
  } else {
    result = await (supabase as any).from("catalog_variant_packages").insert(payload).select().single();
  }

  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/admin/catalog");
  return { success: true, data: toPackage(result.data) };
}

export async function deleteVariantPackage(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_variant_packages").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
