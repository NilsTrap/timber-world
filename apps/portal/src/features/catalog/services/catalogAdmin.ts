/**
 * Catalog ADMIN write/read service — `(db, …)`-style pure layer over the catalog
 * authoring tables (categories · global fields + options + assignments · products
 * + variants · packaging types + variant-packaging · currencies + derived prices),
 * for the Timber MCP catalog surface (T6). Mirrors the pattern of
 * `services/stock.ts` / `services/attributes.ts`: functions take `db` (the caller's
 * Supabase client — the MCP passes the RLS-bypassing admin/service client for the
 * env owner token) and return `ActionResult`. Permission is the caller's job; the
 * MCP route gates every write on the `admin` capability, and every catalog table is
 * additionally RLS-walled to platform admins (`is_current_user_platform_admin`).
 *
 * FAITHFUL PORT of the DB logic in the `"use server"` twins under
 * `catalog/actions/*` (payloads, guards, 23505/23503 translations, ordering), minus
 * the session gate + `revalidatePath` + `logAudit` + `recomputeEntityCurrencies`
 * (all session/cookie-bound → they stay in the action layer). Consequence: an MCP
 * catalog write does NOT re-derive non-EUR prices (recompute) nor emit an audit row
 * — see the T6 handoff note. Kept a separate service (not a rewire of the actions)
 * so this is a purely additive change to load-bearing, un-deploy-verifiable UI code.
 */
import { applyCharmRounding } from "../charmRounding";
import type {
  ActionResult,
  CatalogCategory,
  CatalogField,
  FieldAssignment,
  FieldOption,
  CatalogCurrency,
  RoundingRule,
  SaveCategoryInput,
  SaveFieldInput,
  SaveFieldAssignmentInput,
  SaveFieldOptionInput,
  SaveProductInput,
  SaveVariantInput,
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

// ── row → domain mappers (ported from the action twins) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCategory(row: any): CatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageStoragePath: row.image_storage_path,
    primaryUnit: row.primary_unit,
    defaultPriceEurCents: row.default_price_eur_cents ?? null,
    commissionStandardPct: row.commission_standard_pct != null ? Number(row.commission_standard_pct) : null,
    commissionMaxDiscountPct: row.commission_max_discount_pct != null ? Number(row.commission_max_discount_pct) : null,
    commissionDiscountedPct: row.commission_discounted_pct != null ? Number(row.commission_discounted_pct) : null,
    isActive: row.is_active,
    visibleAgents: row.visible_agents ?? true,
    visibleInternal: row.visible_internal ?? true,
    visibleMarketing: row.visible_marketing ?? true,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldCount: row.field_count,
    productCount: row.product_count,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAssignment(row: any): FieldAssignment {
  return {
    id: row.id,
    categoryId: row.category_id,
    fieldId: row.field_id,
    appliesTo: row.applies_to,
    showInFilter: row.show_in_filter,
    showInDetail: row.show_in_detail,
    showInPriceList: row.show_in_price_list,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCurrency(row: any): CatalogCurrency {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    isBase: row.is_base,
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    rateSource: row.rate_source,
    rateFetchedAt: row.rate_fetched_at,
    roundingRule: row.rounding_rule ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export interface PackagingType {
  id: string;
  name: string;
  piecesPerPackage: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPackagingType(row: any): PackagingType {
  return {
    id: row.id,
    name: row.name,
    piecesPerPackage: row.pieces_per_package,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export interface VariantPackaging {
  id: string;
  variantId: string;
  packagingTypeId: string;
  name: string;
  piecesPerPackage: number;
  description: string | null;
  priceOverrideCents: number | null;
  isDefault: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVariantPackaging(row: any): VariantPackaging {
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

/** Compact product/variant projection returned by the save/duplicate services. */
export interface CatalogProductCore {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  basePriceEurCents: number | null;
  isActive: boolean;
  visibleAgents: boolean;
  visibleInternal: boolean;
  visibleMarketing: boolean;
  sortOrder: number;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductCore(row: any): CatalogProductCore {
  return {
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    basePriceEurCents: row.base_price_eur_cents ?? null,
    isActive: row.is_active,
    visibleAgents: row.visible_agents ?? true,
    visibleInternal: row.visible_internal ?? true,
    visibleMarketing: row.visible_marketing ?? true,
    sortOrder: row.sort_order,
  };
}

export interface CatalogVariantCore {
  id: string;
  productId: string;
  sku: string | null;
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
  lengthMinMm: number | null;
  lengthMaxMm: number | null;
  priceEurCents: number | null;
  stockUnit: string;
  isActive: boolean;
  sortOrder: number;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVariantCore(row: any): CatalogVariantCore {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku ?? null,
    thicknessMm: row.thickness_mm ?? null,
    widthMm: row.width_mm ?? null,
    lengthMm: row.length_mm ?? null,
    lengthMinMm: row.length_min_mm ?? null,
    lengthMaxMm: row.length_max_mm ?? null,
    priceEurCents: row.price_eur_cents ?? null,
    stockUnit: row.stock_unit ?? "piece",
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export async function listCategories(db: DbClient): Promise<ActionResult<CatalogCategory[]>> {
  const { data, error } = await db
    .from("catalog_categories")
    .select("*, catalog_category_field_assignments(id), catalog_products(id)")
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = (data || []).map((row: any) => ({
    ...row,
    field_count: row.catalog_category_field_assignments?.length ?? 0,
    product_count: row.catalog_products?.length ?? 0,
  })).map(toCategory);
  return { success: true, data: categories };
}

export async function getCategory(db: DbClient, id: string): Promise<ActionResult<CatalogCategory>> {
  const { data, error } = await db
    .from("catalog_categories")
    .select("*, catalog_category_field_assignments(id), catalog_products(id)")
    .eq("id", id)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Category not found", code: "NOT_FOUND" };
  return {
    success: true,
    data: toCategory({
      ...data,
      field_count: data.catalog_category_field_assignments?.length ?? 0,
      product_count: data.catalog_products?.length ?? 0,
    }),
  };
}

export async function saveCategory(db: DbClient, input: SaveCategoryInput): Promise<ActionResult<CatalogCategory>> {
  const payload = {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    primary_unit: input.primaryUnit,
    default_price_eur_cents: input.defaultPriceEurCents ?? null,
    commission_standard_pct: input.commissionStandardPct ?? null,
    commission_max_discount_pct: input.commissionMaxDiscountPct ?? null,
    commission_discounted_pct: input.commissionDiscountedPct ?? null,
    is_active: input.isActive ?? true,
    ...(input.visibleAgents !== undefined ? { visible_agents: input.visibleAgents } : {}),
    ...(input.visibleInternal !== undefined ? { visible_internal: input.visibleInternal } : {}),
    ...(input.visibleMarketing !== undefined ? { visible_marketing: input.visibleMarketing } : {}),
    sort_order: input.sortOrder ?? 0,
  };
  const result = input.id
    ? await db.from("catalog_categories").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_categories").insert(payload).select().single();
  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: "A category with this slug already exists", code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }
  return { success: true, data: toCategory(result.data) };
}

export async function duplicateCategory(db: DbClient, id: string): Promise<ActionResult<CatalogCategory>> {
  const { data: source, error: fetchErr } = await db.from("catalog_categories").select("*").eq("id", id).single();
  if (fetchErr || !source) return { success: false, error: "Category not found" };

  const { data: newCat, error: insertErr } = await db
    .from("catalog_categories")
    .insert({
      slug: source.slug + "-copy",
      name: source.name + " (Copy)",
      description: source.description,
      image_storage_path: source.image_storage_path,
      primary_unit: source.primary_unit,
      default_price_eur_cents: source.default_price_eur_cents,
      commission_standard_pct: source.commission_standard_pct,
      commission_max_discount_pct: source.commission_max_discount_pct,
      commission_discounted_pct: source.commission_discounted_pct,
      is_active: false,
      visible_agents: source.visible_agents,
      visible_internal: source.visible_internal,
      visible_marketing: source.visible_marketing,
      sort_order: source.sort_order + 1,
    })
    .select()
    .single();
  if (insertErr) return { success: false, error: insertErr.message };

  const { data: assignments } = await db
    .from("catalog_category_field_assignments")
    .select("*")
    .eq("category_id", id);
  if (assignments && assignments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    await db.from("catalog_category_field_assignments").insert(newAssignments);
  }
  return { success: true, data: toCategory({ ...newCat, field_count: assignments?.length ?? 0, product_count: 0 }) };
}

/**
 * Delete a category — CASCADE (mirrors the action): variants → products → the
 * category (its field assignments cascade automatically). This also permanently
 * deletes every product + variant in the category. The UI shows a confirm dialog
 * (product/variant counts) but the underlying delete does not hard-block.
 */
export async function deleteCategory(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { data: products } = await db.from("catalog_products").select("id").eq("category_id", id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productIds = (products || []).map((p: any) => p.id);
  if (productIds.length > 0) {
    const { error: variantErr } = await db.from("catalog_variants").delete().in("product_id", productIds);
    if (variantErr) return { success: false, error: variantErr.message };
    const { error: productErr } = await db.from("catalog_products").delete().eq("category_id", id);
    if (productErr) return { success: false, error: productErr.message };
  }
  const { error } = await db.from("catalog_categories").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Global fields + options + category assignments
// ─────────────────────────────────────────────────────────────────────────────

/** The field_key slug guard the action applies (Epic S review finding #2). */
export function isValidFieldKey(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

export async function saveField(db: DbClient, input: SaveFieldInput): Promise<ActionResult<CatalogField>> {
  if (input.fieldKey && !isValidFieldKey(input.fieldKey)) {
    return { success: false, error: "Field key must be letters, digits and underscores only (starting with a letter or underscore).", code: "INVALID_FIELD_KEY" };
  }

  // System (dimension) fields: protect key + type; only label/unit may change.
  if (input.id) {
    const { data: existing } = await db.from("catalog_fields").select("is_system, field_key, field_type").eq("id", input.id).single();
    if (existing?.is_system) {
      const { data, error } = await db
        .from("catalog_fields")
        .update({ field_label: input.fieldLabel, unit: input.unit ?? null })
        .eq("id", input.id)
        .select("*, catalog_field_options(*)")
        .single();
      if (error) return { success: false, error: error.message };
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
  const result = input.id
    ? await db.from("catalog_fields").update(payload).eq("id", input.id).select("*, catalog_field_options(*)").single()
    : await db.from("catalog_fields").insert(payload).select("*, catalog_field_options(*)").single();
  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: `Field key "${input.fieldKey}" already exists`, code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }
  return { success: true, data: toGlobalField(result.data) };
}

export async function deleteField(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { data: existing } = await db.from("catalog_fields").select("is_system").eq("id", id).single();
  if (existing?.is_system) {
    return { success: false, error: "System fields (dimensions) cannot be deleted — pricing depends on them.", code: "SYSTEM_FIELD" };
  }
  const { error } = await db.from("catalog_fields").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function saveFieldOption(db: DbClient, input: SaveFieldOptionInput): Promise<ActionResult<FieldOption>> {
  const payload = {
    field_id: input.fieldId,
    ref_value_id: input.refValueId ?? null,
    value: input.value,
    label: input.label,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };
  const result = input.id
    ? await db.from("catalog_field_options").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_field_options").insert(payload).select().single();
  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: `Option "${input.value}" already exists`, code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }
  return { success: true, data: toOption(result.data) };
}

export async function deleteFieldOption(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_field_options").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function saveFieldAssignment(db: DbClient, input: SaveFieldAssignmentInput): Promise<ActionResult<FieldAssignment>> {
  if (!["product", "variant", "process"].includes(input.appliesTo)) {
    return { success: false, error: "Invalid field scope", code: "VALIDATION_ERROR" };
  }
  if (input.appliesTo === "process") {
    const { data: field, error } = await db.from("catalog_fields").select("field_type").eq("id", input.fieldId).single();
    if (error) return { success: false, error: "Could not validate process field", code: "FETCH_FAILED" };
    if (["boolean", "file"].includes(field.field_type as string)) return { success: false, error: "Boolean and file fields cannot be process requirements", code: "VALIDATION_ERROR" };
  }
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
  const result = input.id
    ? await db.from("catalog_category_field_assignments").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_category_field_assignments").insert(payload).select().single();
  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: "This field is already assigned to this category", code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }
  return { success: true, data: toAssignment(result.data) };
}

export async function removeFieldAssignment(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_category_field_assignments").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Products (+ variants field values on save) + bulk actions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProductCore(db: DbClient, id: string): Promise<ActionResult<CatalogProductCore>> {
  const { data, error } = await db.from("catalog_products").select("*").eq("id", id).single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: toProductCore(data) };
}

export async function saveProduct(db: DbClient, input: SaveProductInput): Promise<ActionResult<CatalogProductCore>> {
  const payload = {
    category_id: input.categoryId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    base_price_eur_cents: input.basePriceEurCents ?? null,
    is_active: input.isActive ?? true,
    ...(input.visibleAgents !== undefined ? { visible_agents: input.visibleAgents } : {}),
    ...(input.visibleInternal !== undefined ? { visible_internal: input.visibleInternal } : {}),
    ...(input.visibleMarketing !== undefined ? { visible_marketing: input.visibleMarketing } : {}),
    sort_order: input.sortOrder ?? 0,
  };

  let productId: string;
  const result = input.id
    ? await db.from("catalog_products").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_products").insert(payload).select().single();
  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: "A product with this slug already exists in this category", code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }
  productId = result.data.id;

  if (input.fieldValues && input.fieldValues.length > 0) {
    await db.from("catalog_product_field_values").delete().eq("product_id", productId);
    const fvRows = input.fieldValues.map((fv) => ({
      product_id: productId,
      field_id: fv.fieldId,
      option_id: fv.optionId ?? null,
      value_text: fv.valueText ?? null,
      value_number: fv.valueNumber ?? null,
      value_storage_path: fv.valueStoragePath ?? null,
      value_file_name: fv.valueFileName ?? null,
      value_mime_type: fv.valueMimeType ?? null,
      value_file_size_bytes: fv.valueFileSizeBytes ?? null,
    }));
    const { error: fvError } = await db.from("catalog_product_field_values").insert(fvRows);
    // Mirrors the action: field-value insert failure is logged, not fatal.
    if (fvError) console.error("saveProduct field values error:", fvError.message);
  }
  return fetchProductCore(db, productId);
}

export async function duplicateProduct(db: DbClient, id: string): Promise<ActionResult<CatalogProductCore>> {
  const { data: source, error: fetchErr } = await db.from("catalog_products").select("*").eq("id", id).single();
  if (fetchErr || !source) return { success: false, error: "Product not found" };

  const { data: newProd, error: insertErr } = await db
    .from("catalog_products")
    .insert({
      category_id: source.category_id,
      slug: source.slug + "-copy",
      name: source.name + " (Copy)",
      description: source.description,
      base_price_eur_cents: source.base_price_eur_cents,
      is_active: false,
      visible_agents: source.visible_agents,
      visible_internal: source.visible_internal,
      visible_marketing: source.visible_marketing,
      sort_order: source.sort_order + 1,
    })
    .select()
    .single();
  if (insertErr) return { success: false, error: insertErr.message };

  const { data: fieldValues } = await db.from("catalog_product_field_values").select("*").eq("product_id", id);
  if (fieldValues && fieldValues.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.from("catalog_product_field_values").insert(fieldValues.map((fv: any) => ({
      product_id: newProd.id,
      field_id: fv.field_id,
      option_id: fv.option_id,
      value_text: fv.value_text,
      value_number: fv.value_number,
      value_storage_path: fv.value_storage_path,
      value_file_name: fv.value_file_name,
      value_mime_type: fv.value_mime_type,
      value_file_size_bytes: fv.value_file_size_bytes,
    })));
  }

  const { data: variants } = await db.from("catalog_variants").select("*").eq("product_id", id);
  if (variants && variants.length > 0) {
    for (const v of variants) {
      const { data: newVariant } = await db
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
        const { data: vfvs } = await db.from("catalog_variant_field_values").select("*").eq("variant_id", v.id);
        if (vfvs && vfvs.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from("catalog_variant_field_values").insert(vfvs.map((fv: any) => ({
            variant_id: newVariant.id,
            field_id: fv.field_id,
            option_id: fv.option_id,
            value_text: fv.value_text,
            value_number: fv.value_number,
            value_storage_path: fv.value_storage_path,
            value_file_name: fv.value_file_name,
            value_mime_type: fv.value_mime_type,
            value_file_size_bytes: fv.value_file_size_bytes,
          })));
        }
      }
    }
  }
  return fetchProductCore(db, newProd.id);
}

export async function deleteProduct(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { success: false, error: "Cannot delete: product has variants. Remove all variants first.", code: "HAS_CHILDREN" };
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}

/** Delete N products (variants first — RESTRICT on product FK). */
export async function bulkDeleteProducts(db: DbClient, ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  if (ids.length === 0) return { success: true, data: { deleted: 0 } };
  const { error: vErr } = await db.from("catalog_variants").delete().in("product_id", ids);
  if (vErr) return { success: false, error: vErr.message };
  const { error, count } = await db.from("catalog_products").delete({ count: "exact" }).in("id", ids);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { deleted: count ?? ids.length } };
}

export async function bulkSetProductsActive(db: DbClient, ids: string[], isActive: boolean): Promise<ActionResult<{ updated: number }>> {
  if (ids.length === 0) return { success: true, data: { updated: 0 } };
  const { error, count } = await db.from("catalog_products").update({ is_active: isActive }, { count: "exact" }).in("id", ids);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { updated: count ?? ids.length } };
}

export async function bulkSetProductsVisibility(
  db: DbClient,
  ids: string[],
  visibility: { visibleAgents?: boolean; visibleInternal?: boolean; visibleMarketing?: boolean },
): Promise<ActionResult<{ updated: number }>> {
  if (ids.length === 0) return { success: true, data: { updated: 0 } };
  const payload: Record<string, boolean> = {};
  if (visibility.visibleAgents !== undefined) payload.visible_agents = visibility.visibleAgents;
  if (visibility.visibleInternal !== undefined) payload.visible_internal = visibility.visibleInternal;
  if (visibility.visibleMarketing !== undefined) payload.visible_marketing = visibility.visibleMarketing;
  if (Object.keys(payload).length === 0) return { success: false, error: "No visibility surfaces selected" };
  const { error, count } = await db.from("catalog_products").update(payload, { count: "exact" }).in("id", ids);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { updated: count ?? ids.length } };
}

export async function bulkMoveProductsToCategory(db: DbClient, ids: string[], categoryId: string): Promise<ActionResult<{ updated: number }>> {
  if (ids.length === 0) return { success: true, data: { updated: 0 } };
  if (!categoryId) return { success: false, error: "Target category is required" };
  const { error, count } = await db.from("catalog_products").update({ category_id: categoryId }, { count: "exact" }).in("id", ids);
  if (error) {
    if (error.code === "23505") return { success: false, error: "A product with the same slug already exists in the target category. Rename the conflicting slug first.", code: "DUPLICATE" };
    return { success: false, error: error.message };
  }
  return { success: true, data: { updated: count ?? ids.length } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────────────────

export async function saveVariant(db: DbClient, input: SaveVariantInput): Promise<ActionResult<CatalogVariantCore>> {
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
  const result = input.id
    ? await db.from("catalog_variants").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_variants").insert(payload).select().single();
  if (result.error) return { success: false, error: result.error.message };
  variantId = result.data.id;

  if (input.fieldValues && input.fieldValues.length > 0) {
    await db.from("catalog_variant_field_values").delete().eq("variant_id", variantId);
    const fvRows = input.fieldValues.map((fv) => ({
      variant_id: variantId,
      field_id: fv.fieldId,
      option_id: fv.optionId ?? null,
      value_text: fv.valueText ?? null,
      value_number: fv.valueNumber ?? null,
      value_storage_path: fv.valueStoragePath ?? null,
      value_file_name: fv.valueFileName ?? null,
      value_mime_type: fv.valueMimeType ?? null,
      value_file_size_bytes: fv.valueFileSizeBytes ?? null,
    }));
    const { error: fvError } = await db.from("catalog_variant_field_values").insert(fvRows);
    if (fvError) console.error("saveVariant field values error:", fvError.message);
  }
  return { success: true, data: toVariantCore(result.data) };
}

export async function deleteVariant(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_variants").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Packaging types + variant-packaging assignments
// ─────────────────────────────────────────────────────────────────────────────

export interface SavePackagingTypeInput {
  id?: string;
  name: string;
  piecesPerPackage: number;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function savePackagingType(db: DbClient, input: SavePackagingTypeInput): Promise<ActionResult<PackagingType>> {
  const payload = {
    name: input.name,
    pieces_per_package: input.piecesPerPackage,
    description: input.description ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };
  const result = input.id
    ? await db.from("catalog_packaging_types").update(payload).eq("id", input.id).select().single()
    : await db.from("catalog_packaging_types").insert(payload).select().single();
  if (result.error) return { success: false, error: result.error.message };
  return { success: true, data: toPackagingType(result.data) };
}

export async function deletePackagingType(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_packaging_types").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export interface AssignVariantPackagingInput {
  variantId: string;
  packagingTypeId: string;
  priceOverrideCents?: number | null;
  isDefault?: boolean;
}

export async function assignVariantPackaging(db: DbClient, input: AssignVariantPackagingInput): Promise<ActionResult<VariantPackaging>> {
  // Only one default per variant.
  if (input.isDefault) {
    await db.from("catalog_variant_packaging_assignments").update({ is_default: false }).eq("variant_id", input.variantId);
  }
  const { data, error } = await db
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
  return { success: true, data: toVariantPackaging(data) };
}

export async function removeVariantPackaging(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_variant_packaging_assignments").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Currencies + derived prices
// ─────────────────────────────────────────────────────────────────────────────

const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export async function listCurrencies(db: DbClient): Promise<ActionResult<CatalogCurrency[]>> {
  const { data, error } = await db.from("catalog_currencies").select("*").order("sort_order", { ascending: true });
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toCurrency) };
}

export interface CurrencyPriceEntry {
  priceCents: number;
  isManual: boolean;
}
export type CurrencyPriceMap = Record<string, Record<string, CurrencyPriceEntry>>;

export async function getCatalogCurrencyPrices(db: DbClient, entityIds: string[]): Promise<ActionResult<CurrencyPriceMap>> {
  if (entityIds.length === 0) return { success: true, data: {} };
  const { data, error } = await db
    .from("catalog_currency_prices")
    .select("entity_type, entity_id, currency_code, price_cents, is_manual")
    .in("entity_id", entityIds);
  if (error) return { success: false, error: error.message };
  const map: CurrencyPriceMap = {};
  for (const r of data || []) {
    const key = `${r.entity_type}:${r.entity_id}`;
    (map[key] ??= {})[r.currency_code] = { priceCents: r.price_cents, isManual: r.is_manual };
  }
  return { success: true, data: map };
}

export interface SaveCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  roundingRule?: RoundingRule | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function saveCurrency(db: DbClient, input: SaveCurrencyInput): Promise<ActionResult<CatalogCurrency>> {
  const code = input.code.trim().toUpperCase();
  // Upsert by primary key (code). is_base is never set here (only EUR seeded as base).
  const { data, error } = await db
    .from("catalog_currencies")
    .upsert({
      code,
      name: input.name,
      symbol: input.symbol,
      rounding_rule: input.roundingRule ?? null,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    }, { onConflict: "code" })
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: toCurrency(data) };
}

/** Base currency (EUR) is undeletable — mirror the UI guard. */
export async function deleteCurrency(db: DbClient, code: string): Promise<ActionResult<null>> {
  const { data: cur } = await db.from("catalog_currencies").select("is_base").eq("code", code).maybeSingle();
  if (cur?.is_base) return { success: false, error: "The base currency (EUR) cannot be deleted.", code: "BASE_CURRENCY" };
  const { error } = await db.from("catalog_currencies").delete().eq("code", code);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/**
 * Fetch the latest ECB EUR->code reference rate, store it on the currency, then
 * recompute + replace every AUTO (non-manual) derived price for that currency
 * across categories / products / variants (manual overrides preserved). Faithful
 * port of the action's updateCurrencyPrices (the trigger the UI's "Update rate"
 * button calls). Base currency needs no conversion.
 */
export async function updateCurrencyPrices(
  db: DbClient,
  code: string,
): Promise<ActionResult<{ rate: number; updated: number; fetchedAt: string }>> {
  const { data: currency, error: curErr } = await db.from("catalog_currencies").select("*").eq("code", code).single();
  if (curErr || !currency) return { success: false, error: "Currency not found" };
  if (currency.is_base) return { success: false, error: "The base currency needs no conversion." };

  let rate: number;
  try {
    const res = await fetch(ECB_DAILY_URL, { cache: "no-store" });
    if (!res.ok) return { success: false, error: `ECB request failed (${res.status})` };
    const xml = await res.text();
    const match = new RegExp(`currency=['"]${code}['"]\\s+rate=['"]([0-9.]+)['"]`).exec(xml);
    if (!match || !match[1]) return { success: false, error: `ECB did not return a rate for ${code}` };
    rate = parseFloat(match[1]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { success: false, error: `Could not reach ECB: ${e?.message ?? "network error"}` };
  }

  const fetchedAt = new Date().toISOString();
  await db.from("catalog_currencies").update({ exchange_rate: rate, rate_source: "ecb", rate_fetched_at: fetchedAt }).eq("code", code);

  const rule: RoundingRule | null = currency.rounding_rule ?? null;
  const convert = (eurCents: number): number => Math.round(applyCharmRounding((eurCents / 100) * rate, rule) * 100);

  const { data: manualRows } = await db
    .from("catalog_currency_prices")
    .select("entity_type, entity_id")
    .eq("currency_code", code)
    .eq("is_manual", true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manual = new Set((manualRows || []).map((r: any) => `${r.entity_type}:${r.entity_id}`));

  const rows: { entity_type: string; entity_id: string; currency_code: string; price_cents: number; is_manual: boolean }[] = [];
  const [{ data: cats }, { data: prods }, { data: vars }] = await Promise.all([
    db.from("catalog_categories").select("id, default_price_eur_cents").not("default_price_eur_cents", "is", null),
    db.from("catalog_products").select("id, base_price_eur_cents").not("base_price_eur_cents", "is", null),
    db.from("catalog_variants").select("id, price_eur_cents").not("price_eur_cents", "is", null),
  ]);
  const add = (type: string, id: string, eurCents: number) => {
    if (manual.has(`${type}:${id}`)) return;
    rows.push({ entity_type: type, entity_id: id, currency_code: code, price_cents: convert(eurCents), is_manual: false });
  };
  for (const c of cats || []) add("category", c.id, c.default_price_eur_cents);
  for (const p of prods || []) add("product", p.id, p.base_price_eur_cents);
  for (const v of vars || []) add("variant", v.id, v.price_eur_cents);

  await db.from("catalog_currency_prices").delete().eq("currency_code", code).eq("is_manual", false);
  if (rows.length > 0) {
    const { error: insErr } = await db.from("catalog_currency_prices").insert(rows);
    if (insErr) return { success: false, error: insErr.message };
  }
  return { success: true, data: { rate, updated: rows.length, fetchedAt } };
}

/** Hand-set (or clear) a variant's price in a derived currency. null clears it. */
export async function setVariantCurrencyOverride(
  db: DbClient,
  variantId: string,
  currencyCode: string,
  priceCents: number | null,
): Promise<ActionResult<null>> {
  if (priceCents == null) {
    const { error } = await db
      .from("catalog_currency_prices")
      .delete()
      .match({ entity_type: "variant", entity_id: variantId, currency_code: currencyCode });
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db
      .from("catalog_currency_prices")
      .upsert({
        entity_type: "variant", entity_id: variantId, currency_code: currencyCode,
        price_cents: priceCents, is_manual: true,
      }, { onConflict: "entity_type,entity_id,currency_code" });
    if (error) return { success: false, error: error.message };
  }
  return { success: true, data: null };
}
