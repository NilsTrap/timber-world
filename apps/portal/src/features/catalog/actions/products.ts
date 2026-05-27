"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
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
    field: row.catalog_category_fields ? {
      id: row.catalog_category_fields.id,
      categoryId: row.catalog_category_fields.category_id,
      fieldKey: row.catalog_category_fields.field_key,
      fieldLabel: row.catalog_category_fields.field_label,
      fieldType: row.catalog_category_fields.field_type,
      unit: row.catalog_category_fields.unit,
      appliesTo: row.catalog_category_fields.applies_to,
      refTable: row.catalog_category_fields.ref_table,
      showInFilter: row.catalog_category_fields.show_in_filter,
      showInDetail: row.catalog_category_fields.show_in_detail,
      showInPriceList: row.catalog_category_fields.show_in_price_list,
      isRequired: row.catalog_category_fields.is_required,
      sortOrder: row.catalog_category_fields.sort_order,
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
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_products")
    .select(`
      *,
      catalog_variants(id),
      catalog_product_images(id, storage_path, is_primary, sort_order),
      catalog_product_field_values(
        id, product_id, field_id, option_id, value_text, value_number,
        catalog_category_fields(id, field_key, field_label, field_type, unit, applies_to),
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
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_products")
    .select(`
      *,
      catalog_variants(id),
      catalog_product_images(id, product_id, storage_path, alt_text, is_primary, sort_order),
      catalog_product_field_values(
        id, product_id, field_id, option_id, value_text, value_number,
        catalog_category_fields(id, category_id, field_key, field_label, field_type, unit, applies_to, ref_table, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order),
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
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const payload = {
    category_id: input.categoryId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
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

  revalidatePath("/admin/catalog");
  return getProduct(productId);
}

export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

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
