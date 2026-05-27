"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
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
    .select("*, catalog_category_fields(id), catalog_products(id)")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getCategories error:", error);
    return { success: false, error: error.message };
  }

  const categories = (data || []).map((row: any) => ({
    ...row,
    field_count: row.catalog_category_fields?.length ?? 0,
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
    .select("*, catalog_category_fields(id), catalog_products(id)")
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
      field_count: data.catalog_category_fields?.length ?? 0,
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

  revalidatePath("/admin/catalog");
  return { success: true, data: toCategory(result.data) };
}

export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from("catalog_categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCategory error:", error);
    if (error.code === "23503") {
      return { success: false, error: "Cannot delete: category has products. Remove all products first.", code: "HAS_CHILDREN" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
