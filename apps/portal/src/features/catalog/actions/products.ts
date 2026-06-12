"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recomputeEntityCurrencies } from "../recomputeCurrencies";
import type {
  ActionResult,
  CatalogProduct,
  ProductFieldValue,
  ProductImage,
  SaveProductInput,
} from "../types";

function toProduct(row: any): CatalogProduct {
  return {
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    basePriceEurCents: row.base_price_eur_cents ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variantCount: row.catalog_variants?.length,
    images: row.catalog_product_images?.map(toImage),
    fieldValues: row.catalog_product_field_values?.map(toFieldValue),
  };
}

function toImage(row: any): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    storagePath: row.storage_path,
    altText: row.alt_text,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
  };
}

function toFieldValue(row: any): ProductFieldValue {
  return {
    id: row.id,
    productId: row.product_id,
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

export async function getProducts(
  categoryId: string
): Promise<ActionResult<CatalogProduct[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_products")
    .select(`
      *,
      catalog_variants(id),
      catalog_product_images(id, storage_path, is_primary, sort_order),
      catalog_product_field_values(
        id, product_id, field_id, option_id, value_text, value_number,
        catalog_fields(id, field_key, field_label, field_type, unit, is_system, dimension_role),
        catalog_field_options(id, value, label)
      )
    `)
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getProducts error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []).map(toProduct) };
}

export async function getProduct(
  id: string
): Promise<ActionResult<CatalogProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_products")
    .select(`
      *,
      catalog_variants(id),
      catalog_product_images(id, product_id, storage_path, alt_text, is_primary, sort_order),
      catalog_product_field_values(
        id, product_id, field_id, option_id, value_text, value_number,
        catalog_fields(id, field_key, field_label, field_type, unit, ref_table, is_system, dimension_role),
        catalog_field_options(id, field_id, ref_value_id, value, label, description, description_image_path, sort_order, is_active)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("getProduct error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: toProduct(data) };
}

export async function saveProduct(
  input: SaveProductInput
): Promise<ActionResult<CatalogProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  const payload = {
    category_id: input.categoryId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    base_price_eur_cents: input.basePriceEurCents ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  let productId: string;

  if (input.id) {
    const { data, error } = await (supabase as any)
      .from("catalog_products")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { success: false, error: "A product with this slug already exists in this category", code: "DUPLICATE" };
      return { success: false, error: error.message };
    }
    productId = data.id;
  } else {
    const { data, error } = await (supabase as any)
      .from("catalog_products")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { success: false, error: "A product with this slug already exists in this category", code: "DUPLICATE" };
      return { success: false, error: error.message };
    }
    productId = data.id;
  }

  if (input.fieldValues && input.fieldValues.length > 0) {
    await (supabase as any)
      .from("catalog_product_field_values")
      .delete()
      .eq("product_id", productId);

    const fvRows = input.fieldValues.map((fv) => ({
      product_id: productId,
      field_id: fv.fieldId,
      option_id: fv.optionId ?? null,
      value_text: fv.valueText ?? null,
      value_number: fv.valueNumber ?? null,
    }));

    const { error: fvError } = await (supabase as any)
      .from("catalog_product_field_values")
      .insert(fvRows);

    if (fvError) {
      console.error("saveProduct field values error:", fvError);
    }
  }

  await recomputeEntityCurrencies("product", productId, payload.base_price_eur_cents);
  revalidatePath("/admin/catalog");
  return getProduct(productId);
}

export async function duplicateProduct(id: string): Promise<ActionResult<CatalogProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  const { data: source, error: fetchErr } = await (supabase as any)
    .from("catalog_products")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !source) return { success: false, error: "Product not found" };

  const { data: newProd, error: insertErr } = await (supabase as any)
    .from("catalog_products")
    .insert({
      category_id: source.category_id,
      slug: source.slug + "-copy",
      name: source.name + " (Copy)",
      description: source.description,
      base_price_eur_cents: source.base_price_eur_cents,
      is_active: false,
      sort_order: source.sort_order + 1,
    })
    .select()
    .single();

  if (insertErr) return { success: false, error: insertErr.message };

  const { data: fieldValues } = await (supabase as any)
    .from("catalog_product_field_values")
    .select("*")
    .eq("product_id", id);

  if (fieldValues && fieldValues.length > 0) {
    const newFvs = fieldValues.map((fv: any) => ({
      product_id: newProd.id,
      field_id: fv.field_id,
      option_id: fv.option_id,
      value_text: fv.value_text,
      value_number: fv.value_number,
    }));
    await (supabase as any).from("catalog_product_field_values").insert(newFvs);
  }

  const { data: variants } = await (supabase as any)
    .from("catalog_variants")
    .select("*")
    .eq("product_id", id);

  if (variants && variants.length > 0) {
    for (const v of variants) {
      const { data: newVariant } = await (supabase as any)
        .from("catalog_variants")
        .insert({
          product_id: newProd.id,
          sku: v.sku ? v.sku + "-copy" : null,
          thickness_mm: v.thickness_mm,
          width_mm: v.width_mm,
          length_mm: v.length_mm,
          length_min_mm: v.length_min_mm,
          length_max_mm: v.length_max_mm,
          price_eur_cents: v.price_eur_cents,
          is_active: v.is_active,
          sort_order: v.sort_order,
        })
        .select()
        .single();

      if (newVariant) {
        const { data: vfvs } = await (supabase as any)
          .from("catalog_variant_field_values")
          .select("*")
          .eq("variant_id", v.id);

        if (vfvs && vfvs.length > 0) {
          await (supabase as any).from("catalog_variant_field_values").insert(
            vfvs.map((fv: any) => ({
              variant_id: newVariant.id,
              field_id: fv.field_id,
              option_id: fv.option_id,
              value_text: fv.value_text,
              value_number: fv.value_number,
            }))
          );
        }
      }
    }
  }

  revalidatePath("/admin/catalog");
  return getProduct(newProd.id);
}

export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("catalog_products")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") return { success: false, error: "Cannot delete: product has variants. Remove all variants first.", code: "HAS_CHILDREN" };
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
