"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type {
  ActionResult,
  CategoryField,
  FieldOption,
  SaveFieldInput,
  SaveFieldOptionInput,
} from "../types";

function toField(row: any): CategoryField {
  return {
    id: row.id,
    categoryId: row.category_id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    unit: row.unit,
    appliesTo: row.applies_to,
    refTable: row.ref_table,
    showInFilter: row.show_in_filter,
    showInDetail: row.show_in_detail,
    showInPriceList: row.show_in_price_list,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
    options: row.catalog_field_options
      ? row.catalog_field_options.map(toOption)
      : undefined,
  };
}

function toOption(row: any): FieldOption {
  return {
    id: row.id,
    fieldId: row.field_id,
    refValueId: row.ref_value_id,
    value: row.value,
    label: row.label,
    description: row.description,
    descriptionImagePath: row.description_image_path,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function getCategoryFields(
  categoryId: string
): Promise<ActionResult<CategoryField[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_category_fields")
    .select("*, catalog_field_options(*)")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getCategoryFields error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []).map(toField) };
}

export async function saveCategoryField(
  input: SaveFieldInput
): Promise<ActionResult<CategoryField>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const payload = {
    category_id: input.categoryId,
    field_key: input.fieldKey,
    field_label: input.fieldLabel,
    field_type: input.fieldType,
    unit: input.unit ?? null,
    applies_to: input.appliesTo,
    ref_table: input.refTable ?? null,
    show_in_filter: input.showInFilter ?? false,
    show_in_detail: input.showInDetail ?? true,
    show_in_price_list: input.showInPriceList ?? false,
    is_required: input.isRequired ?? false,
    sort_order: input.sortOrder ?? 0,
  };

  let result;
  if (input.id) {
    result = await (supabase as any)
      .from("catalog_category_fields")
      .update(payload)
      .eq("id", input.id)
      .select("*, catalog_field_options(*)")
      .single();
  } else {
    result = await (supabase as any)
      .from("catalog_category_fields")
      .insert(payload)
      .select("*, catalog_field_options(*)")
      .single();
  }

  if (result.error) {
    console.error("saveCategoryField error:", result.error);
    if (result.error.code === "23505") {
      return { success: false, error: `Field key "${input.fieldKey}" already exists in this category`, code: "DUPLICATE" };
    }
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: toField(result.data) };
}

export async function deleteCategoryField(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("catalog_category_fields")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCategoryField error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}

export async function saveFieldOption(
  input: SaveFieldOptionInput
): Promise<ActionResult<FieldOption>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const payload = {
    field_id: input.fieldId,
    ref_value_id: input.refValueId ?? null,
    value: input.value,
    label: input.label,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };

  let result;
  if (input.id) {
    result = await (supabase as any)
      .from("catalog_field_options")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
  } else {
    result = await (supabase as any)
      .from("catalog_field_options")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    console.error("saveFieldOption error:", result.error);
    if (result.error.code === "23505") {
      return { success: false, error: `Option value "${input.value}" already exists for this field`, code: "DUPLICATE" };
    }
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: toOption(result.data) };
}

export async function deleteFieldOption(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("catalog_field_options")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteFieldOption error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
