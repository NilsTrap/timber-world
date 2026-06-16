"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type {
  ActionResult,
  CatalogField,
  CategoryField,
  FieldOption,
  FieldAssignment,
  SaveFieldInput,
  SaveFieldAssignmentInput,
  SaveFieldOptionInput,
} from "../types";

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

function toGlobalField(row: any): CatalogField {
  return {
    id: row.id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    unit: row.unit,
    refTable: row.ref_table,
    isSystem: row.is_system ?? false,
    dimensionRole: row.dimension_role ?? null,
    options: row.catalog_field_options?.map(toOption),
  };
}

function toCategoryField(assignmentRow: any): CategoryField {
  const f = assignmentRow.catalog_fields;
  return {
    id: f.id,
    assignmentId: assignmentRow.id,
    fieldKey: f.field_key,
    fieldLabel: f.field_label,
    fieldType: f.field_type,
    unit: f.unit,
    refTable: f.ref_table,
    isSystem: f.is_system ?? false,
    dimensionRole: f.dimension_role ?? null,
    appliesTo: assignmentRow.applies_to,
    showInFilter: assignmentRow.show_in_filter,
    showInDetail: assignmentRow.show_in_detail,
    showInPriceList: assignmentRow.show_in_price_list,
    isRequired: assignmentRow.is_required,
    sortOrder: assignmentRow.sort_order,
    options: f.catalog_field_options?.map(toOption),
  };
}

// ---- Global Fields ----

export async function getAllFields(): Promise<ActionResult<CatalogField[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_fields")
    .select("*, catalog_field_options(*), catalog_category_field_assignments(id, applies_to, catalog_categories(id, name))")
    .order("field_label", { ascending: true });

  if (error) return { success: false, error: error.message };

  const fields = (data || []).map((row: any) => {
    const base = toGlobalField(row);
    const assignments = (row.catalog_category_field_assignments || []).map((a: any) => ({
      categoryId: a.catalog_categories?.id,
      categoryName: a.catalog_categories?.name,
      appliesTo: a.applies_to as string,
    }));
    return { ...base, assignments };
  });

  return { success: true, data: fields };
}

export async function saveField(input: SaveFieldInput): Promise<ActionResult<CatalogField>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // System (dimension) fields: protect key + type from edits; only label/unit may change.
  if (input.id) {
    const { data: existing } = await (supabase as any)
      .from("catalog_fields")
      .select("is_system, field_key, field_type")
      .eq("id", input.id)
      .single();
    if (existing?.is_system) {
      const { data, error } = await (supabase as any)
        .from("catalog_fields")
        .update({ field_label: input.fieldLabel, unit: input.unit ?? null })
        .eq("id", input.id)
        .select("*, catalog_field_options(*)")
        .single();
      if (error) return { success: false, error: error.message };
      revalidatePath("/admin/catalog");
      revalidatePath("/admin/settings/fields");
      return { success: true, data: toGlobalField(data) };
    }
  }

  const payload = {
    field_key: input.fieldKey,
    field_label: input.fieldLabel,
    field_type: input.fieldType,
    unit: input.unit ?? null,
    ref_table: input.refTable ?? null,
  };

  let result;
  if (input.id) {
    result = await (supabase as any).from("catalog_fields").update(payload).eq("id", input.id).select("*, catalog_field_options(*)").single();
  } else {
    result = await (supabase as any).from("catalog_fields").insert(payload).select("*, catalog_field_options(*)").single();
  }

  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: `Field key "${input.fieldKey}" already exists`, code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: toGlobalField(result.data) };
}

export async function deleteField(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  const { data: existing } = await (supabase as any)
    .from("catalog_fields")
    .select("is_system")
    .eq("id", id)
    .single();
  if (existing?.is_system) {
    return { success: false, error: "System fields (dimensions) cannot be deleted — pricing depends on them.", code: "SYSTEM_FIELD" };
  }

  const { error } = await (supabase as any).from("catalog_fields").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: null };
}

// ---- Category Field Assignments ----

export async function getCategoryFields(categoryId: string): Promise<ActionResult<CategoryField[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_category_field_assignments")
    .select("*, catalog_fields(*, catalog_field_options(*))")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toCategoryField) };
}

export async function saveFieldAssignment(input: SaveFieldAssignmentInput): Promise<ActionResult<FieldAssignment>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const payload = {
    category_id: input.categoryId,
    field_id: input.fieldId,
    applies_to: input.appliesTo,
    show_in_filter: input.showInFilter ?? false,
    show_in_detail: input.showInDetail ?? true,
    show_in_price_list: input.showInPriceList ?? false,
    is_required: input.isRequired ?? false,
    sort_order: input.sortOrder ?? 0,
  };

  let result;
  if (input.id) {
    result = await (supabase as any).from("catalog_category_field_assignments").update(payload).eq("id", input.id).select().single();
  } else {
    result = await (supabase as any).from("catalog_category_field_assignments").insert(payload).select().single();
  }

  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: "This field is already assigned to this category", code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: {
    id: result.data.id,
    categoryId: result.data.category_id,
    fieldId: result.data.field_id,
    appliesTo: result.data.applies_to,
    showInFilter: result.data.show_in_filter,
    showInDetail: result.data.show_in_detail,
    showInPriceList: result.data.show_in_price_list,
    isRequired: result.data.is_required,
    sortOrder: result.data.sort_order,
  }};
}

export async function removeFieldAssignment(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_category_field_assignments").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: null };
}

// ---- Field Options ----

export async function saveFieldOption(input: SaveFieldOptionInput): Promise<ActionResult<FieldOption>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

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
    result = await (supabase as any).from("catalog_field_options").update(payload).eq("id", input.id).select().single();
  } else {
    result = await (supabase as any).from("catalog_field_options").insert(payload).select().single();
  }

  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: `Option "${input.value}" already exists`, code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: toOption(result.data) };
}

export async function deleteFieldOption(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_field_options").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/settings/fields");
  return { success: true, data: null };
}
