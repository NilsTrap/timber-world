"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recomputeEntityCurrencies } from "../recomputeCurrencies";
import type {
  ActionResult,
  CatalogCategory,
  SaveCategoryInput,
} from "../types";

function toCategory(row: any): CatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageStoragePath: row.image_storage_path,
    primaryUnit: row.primary_unit,
    defaultPriceEurCents: row.default_price_eur_cents ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldCount: row.field_count,
    productCount: row.product_count,
  };
}

export async function getCategories(): Promise<ActionResult<CatalogCategory[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_categories")
    .select("*, catalog_category_field_assignments(id), catalog_products(id)")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getCategories error:", error);
    return { success: false, error: error.message };
  }

  const categories = (data || []).map((row: any) => ({
    ...row,
    field_count: row.catalog_category_field_assignments?.length ?? 0,
    product_count: row.catalog_products?.length ?? 0,
  })).map(toCategory);

  return { success: true, data: categories };
}

export async function getCategory(id: string): Promise<ActionResult<CatalogCategory>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_categories")
    .select("*, catalog_category_field_assignments(id), catalog_products(id)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("getCategory error:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: toCategory({
      ...data,
      field_count: data.catalog_category_field_assignments?.length ?? 0,
      product_count: data.catalog_products?.length ?? 0,
    }),
  };
}

export async function saveCategory(input: SaveCategoryInput): Promise<ActionResult<CatalogCategory>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const payload = {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    primary_unit: input.primaryUnit,
    default_price_eur_cents: input.defaultPriceEurCents ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  let result;
  if (input.id) {
    result = await (supabase as any)
      .from("catalog_categories")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
  } else {
    result = await (supabase as any)
      .from("catalog_categories")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    console.error("saveCategory error:", result.error);
    if (result.error.code === "23505") {
      return { success: false, error: "A category with this slug already exists", code: "DUPLICATE" };
    }
    return { success: false, error: result.error.message };
  }

  await recomputeEntityCurrencies("category", result.data.id, payload.default_price_eur_cents);
  revalidatePath("/admin/catalog");
  return { success: true, data: toCategory(result.data) };
}

export async function duplicateCategory(id: string): Promise<ActionResult<CatalogCategory>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data: source, error: fetchErr } = await (supabase as any)
    .from("catalog_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !source) return { success: false, error: "Category not found" };

  const { data: newCat, error: insertErr } = await (supabase as any)
    .from("catalog_categories")
    .insert({
      slug: source.slug + "-copy",
      name: source.name + " (Copy)",
      description: source.description,
      image_storage_path: source.image_storage_path,
      primary_unit: source.primary_unit,
      default_price_eur_cents: source.default_price_eur_cents,
      is_active: false,
      sort_order: source.sort_order + 1,
    })
    .select()
    .single();

  if (insertErr) return { success: false, error: insertErr.message };

  const { data: assignments } = await (supabase as any)
    .from("catalog_category_field_assignments")
    .select("*")
    .eq("category_id", id);

  if (assignments && assignments.length > 0) {
    const newAssignments = assignments.map((a: any) => ({
      category_id: newCat.id,
      field_id: a.field_id,
      applies_to: a.applies_to,
      show_in_filter: a.show_in_filter,
      show_in_detail: a.show_in_detail,
      show_in_price_list: a.show_in_price_list,
      is_required: a.is_required,
      sort_order: a.sort_order,
    }));
    await (supabase as any).from("catalog_category_field_assignments").insert(newAssignments);
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: toCategory({ ...newCat, field_count: assignments?.length ?? 0, product_count: 0 }) };
}

export async function getCategoryDeletionInfo(
  id: string
): Promise<ActionResult<{ productCount: number; variantCount: number }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data: products } = await (supabase as any)
    .from("catalog_products")
    .select("id, catalog_variants(id)")
    .eq("category_id", id);

  const productCount = products?.length ?? 0;
  const variantCount = (products || []).reduce(
    (sum: number, p: any) => sum + (p.catalog_variants?.length ?? 0), 0
  );

  return { success: true, data: { productCount, variantCount } };
}

export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  // Cascade delete: variants → products → category.
  // (Field values and images cascade automatically via ON DELETE CASCADE.)
  const { data: products } = await (supabase as any)
    .from("catalog_products")
    .select("id")
    .eq("category_id", id);

  const productIds = (products || []).map((p: any) => p.id);

  if (productIds.length > 0) {
    // Delete variants first (RESTRICT on product FK)
    const { error: variantErr } = await (supabase as any)
      .from("catalog_variants")
      .delete()
      .in("product_id", productIds);
    if (variantErr) {
      console.error("deleteCategory variants error:", variantErr);
      return { success: false, error: variantErr.message };
    }

    // Then products (RESTRICT on category FK)
    const { error: productErr } = await (supabase as any)
      .from("catalog_products")
      .delete()
      .eq("category_id", id);
    if (productErr) {
      console.error("deleteCategory products error:", productErr);
      return { success: false, error: productErr.message };
    }
  }

  // Finally the category (field assignments cascade automatically)
  const { error } = await (supabase as any)
    .from("catalog_categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCategory error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
