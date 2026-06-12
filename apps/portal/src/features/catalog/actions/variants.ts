"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recomputeEntityCurrencies } from "../recomputeCurrencies";
import type {
  ActionResult,
  CatalogVariant,
  VariantFieldValue,
  SaveVariantInput,
} from "../types";

function toVariant(row: any): CatalogVariant {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    thicknessMm: row.thickness_mm,
    widthMm: row.width_mm,
    lengthMm: row.length_mm,
    lengthMinMm: row.length_min_mm,
    lengthMaxMm: row.length_max_mm,
    priceEurCents: row.price_eur_cents ?? null,
    stockQuantity: row.stock_quantity != null ? Number(row.stock_quantity) : null,
    stockUnit: row.stock_unit ?? "piece",
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldValues: row.catalog_variant_field_values?.map(toFieldValue),
    images: row.catalog_variant_images?.map((img: any) => ({
      id: img.id,
      variantId: img.variant_id,
      storagePath: img.storage_path,
      altText: img.alt_text,
      isPrimary: img.is_primary,
      sortOrder: img.sort_order,
    })),
    defaultPackaging: toDefaultPackaging(row.catalog_variant_packaging_assignments),
  };
}

function toDefaultPackaging(assignments: any[]): any {
  const def = (assignments || []).find((a: any) => a.is_default) ?? (assignments || [])[0];
  if (!def) return null;
  return {
    assignmentId: def.id,
    packagingTypeId: def.packaging_type_id,
    name: def.catalog_packaging_types?.name ?? "",
    piecesPerPackage: def.catalog_packaging_types?.pieces_per_package ?? 0,
  };
}

function toFieldValue(row: any): VariantFieldValue {
  return {
    id: row.id,
    variantId: row.variant_id,
    fieldId: row.field_id,
    optionId: row.option_id,
    valueText: row.value_text,
    valueNumber: row.value_number,
    field: row.catalog_fields ? {
      id: row.catalog_fields.id,
      fieldKey: row.catalog_fields.field_key,
      fieldLabel: row.catalog_fields.field_label,
      fieldType: row.catalog_fields.field_type,
      unit: row.catalog_fields.unit,
      refTable: row.catalog_fields.ref_table,
      isSystem: row.catalog_fields.is_system ?? false,
      dimensionRole: row.catalog_fields.dimension_role ?? null,
    } : undefined,
    option: row.catalog_field_options ? {
      id: row.catalog_field_options.id,
      fieldId: row.catalog_field_options.field_id,
      refValueId: row.catalog_field_options.ref_value_id,
      value: row.catalog_field_options.value,
      label: row.catalog_field_options.label,
      description: row.catalog_field_options.description,
      descriptionImagePath: row.catalog_field_options.description_image_path,
      sortOrder: row.catalog_field_options.sort_order,
      isActive: row.catalog_field_options.is_active,
    } : undefined,
  };
}

export async function getVariants(
  productId: string
): Promise<ActionResult<CatalogVariant[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_variants")
    .select(`
      *,
      catalog_variant_images(id, variant_id, storage_path, alt_text, is_primary, sort_order),
      catalog_variant_field_values(
        id, variant_id, field_id, option_id, value_text, value_number,
        catalog_fields(id, field_key, field_label, field_type, unit, is_system, dimension_role),
        catalog_field_options(id, value, label)
      ),
      catalog_variant_packaging_assignments(
        id, packaging_type_id, is_default,
        catalog_packaging_types(name, pieces_per_package)
      )
    `)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getVariants error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []).map(toVariant) };
}

export async function saveVariant(
  input: SaveVariantInput
): Promise<ActionResult<CatalogVariant>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const payload = {
    product_id: input.productId,
    sku: input.sku ?? null,
    thickness_mm: input.thicknessMm ?? null,
    width_mm: input.widthMm ?? null,
    length_mm: input.lengthMm ?? null,
    length_min_mm: input.lengthMinMm ?? null,
    length_max_mm: input.lengthMaxMm ?? null,
    price_eur_cents: input.priceEurCents ?? null,
    stock_quantity: input.stockQuantity ?? null,
    stock_unit: input.stockUnit ?? "piece",
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  let variantId: string;

  if (input.id) {
    const { data, error } = await (supabase as any)
      .from("catalog_variants")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    variantId = data.id;
  } else {
    const { data, error } = await (supabase as any)
      .from("catalog_variants")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    variantId = data.id;
  }

  if (input.fieldValues && input.fieldValues.length > 0) {
    await (supabase as any)
      .from("catalog_variant_field_values")
      .delete()
      .eq("variant_id", variantId);

    const fvRows = input.fieldValues.map((fv) => ({
      variant_id: variantId,
      field_id: fv.fieldId,
      option_id: fv.optionId ?? null,
      value_text: fv.valueText ?? null,
      value_number: fv.valueNumber ?? null,
    }));

    const { error: fvError } = await (supabase as any)
      .from("catalog_variant_field_values")
      .insert(fvRows);

    if (fvError) {
      console.error("saveVariant field values error:", fvError);
    }
  }

  await recomputeEntityCurrencies("variant", variantId, payload.price_eur_cents);
  revalidatePath("/admin/catalog");

  const { data: fullVariant, error: fetchError } = await (supabase as any)
    .from("catalog_variants")
    .select(`
      *,
      catalog_variant_images(id, variant_id, storage_path, alt_text, is_primary, sort_order),
      catalog_variant_field_values(
        id, variant_id, field_id, option_id, value_text, value_number,
        catalog_fields(id, field_key, field_label, field_type, unit, is_system, dimension_role),
        catalog_field_options(id, value, label)
      ),
      catalog_variant_packaging_assignments(
        id, packaging_type_id, is_default,
        catalog_packaging_types(name, pieces_per_package)
      )
    `)
    .eq("id", variantId)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  return { success: true, data: toVariant(fullVariant) };
}

export async function deleteVariant(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("catalog_variants")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
