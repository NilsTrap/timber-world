"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

interface ProductWithCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  variantCount: number;
  fieldValues: { option?: { label: string } | null; valueText: string | null }[];
}

export async function getAllProducts(): Promise<ActionResult<ProductWithCategory[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_products")
    .select(`
      *,
      catalog_categories!inner(id, name, slug),
      catalog_variants(id),
      catalog_product_field_values(
        id, option_id, value_text,
        catalog_field_options(label)
      )
    `)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getAllProducts error:", error);
    return { success: false, error: error.message };
  }

  const products: ProductWithCategory[] = (data || []).map((row: any) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.catalog_categories?.name || "",
    categorySlug: row.catalog_categories?.slug || "",
    slug: row.slug,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variantCount: row.catalog_variants?.length ?? 0,
    fieldValues: (row.catalog_product_field_values || []).map((fv: any) => ({
      option: fv.catalog_field_options ? { label: fv.catalog_field_options.label } : null,
      valueText: fv.value_text,
    })),
  }));

  return { success: true, data: products };
}
