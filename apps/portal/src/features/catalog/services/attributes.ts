/**
 * Attribute service — the system-wide controlled-vocabulary layer over the
 * catalog field/option tables (`catalog_fields` + `catalog_field_options`).
 *
 * The catalog already seeds these tables from the legacy `ref_*` data via
 * `ref_value_id`; this service generalises them into a reusable attribute API
 * so other domains (orders/deal line items, the MCP surface, document data
 * assembly) read one controlled vocabulary instead of re-querying catalog
 * internals. No schema change — it wraps the existing tables.
 *
 * Functions take `(db, …)`; `db` = caller-chosen Supabase client (server for
 * UI/RLS, admin for the MCP service identity). Permission is the caller's job.
 * Casts to `any` because the generated DB types don't model these tables yet —
 * matches the codebase convention (see features/orders/services).
 */
import type { ActionResult } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

export interface AttributeDefinition {
  id: string;
  key: string; // field_key — the stable controlled-vocabulary key
  label: string;
  type: string; // 'select' | 'number' | 'text' | 'boolean'
  unit: string | null;
  refTable: string | null;
  isSystem: boolean; // dimension fields (thickness/width/length) — protected
  dimensionRole: string | null;
  optionCount: number; // number of *active* options (0 for non-select fields)
}

export interface AttributeOption {
  id: string;
  fieldId: string;
  value: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  refValueId: string | null;
}

export interface SaveAttributeOptionInput {
  id?: string;
  fieldId?: string; // either fieldId or key must identify the parent field
  key?: string; // field_key
  value: string;
  label: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  refValueId?: string | null;
}

// ── Pure mappers (unit-tested) ───────────────────────────────────────────────

/** Trim a controlled-vocabulary key. Keeps case (field_key is case-sensitive). */
export function normalizeKey(key: string | null | undefined): string {
  return (key ?? "").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOption(row: any): AttributeOption {
  return {
    id: row.id,
    fieldId: row.field_id,
    value: row.value,
    label: row.label,
    description: row.description ?? null,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    refValueId: row.ref_value_id ?? null,
  };
}

/**
 * Map a `catalog_fields` row to an AttributeDefinition. `optionCount` is the
 * number of *active* embedded options (`catalog_field_options(id, is_active)`),
 * so the row must be selected with that relation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDefinition(row: any): AttributeDefinition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any[] = Array.isArray(row.catalog_field_options) ? row.catalog_field_options : [];
  const optionCount = opts.filter((o) => o?.is_active ?? true).length;
  return {
    id: row.id,
    key: row.field_key,
    label: row.field_label,
    type: row.field_type,
    unit: row.unit ?? null,
    refTable: row.ref_table ?? null,
    isSystem: row.is_system ?? false,
    dimensionRole: row.dimension_role ?? null,
    optionCount,
  };
}

/** Sort options by sort_order then label (stable controlled-vocab ordering). */
export function sortOptions(options: AttributeOption[]): AttributeOption[] {
  return [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

// ── DB operations ────────────────────────────────────────────────────────────

const DEFINITION_SELECT =
  "id, field_key, field_label, field_type, unit, ref_table, is_system, dimension_role, catalog_field_options(id, is_active)";

/** List every attribute definition (the controlled-vocabulary registry). */
export async function listDefinitions(db: DbClient): Promise<ActionResult<AttributeDefinition[]>> {
  const c = db as DbClient;
  const { data, error } = await c
    .from("catalog_fields")
    .select(DEFINITION_SELECT)
    .order("field_label", { ascending: true });
  if (error) return { success: false, error: error.message, code: "QUERY_FAILED" };
  return { success: true, data: (data ?? []).map(mapDefinition) };
}

/** A category field = a definition + how it's assigned to the category. This is
 * the shape that drives BOTH the order form/deal picker AND the AI's questions
 * for that category (spec §5). */
export interface CategoryFieldDef extends AttributeDefinition {
  appliesTo: "product" | "variant";
  isRequired: boolean;
  sortOrder: number;
  options: AttributeOption[]; // active options for select fields (empty otherwise)
}

/**
 * The fields assigned to one category (via catalog_category_field_assignments),
 * ordered, with their active options embedded — i.e. the category's spec fields.
 * E5: making a category's fields the AI's question set = calling this with the
 * deal's product group.
 */
export async function listCategoryDefinitions(
  db: DbClient,
  categoryId: string,
): Promise<ActionResult<CategoryFieldDef[]>> {
  const c = db as DbClient;
  const { data, error } = await c
    .from("catalog_category_field_assignments")
    .select(
      "applies_to, is_required, sort_order, " +
        "catalog_fields(" +
        "id, field_key, field_label, field_type, unit, ref_table, is_system, dimension_role, " +
        "catalog_field_options(id, field_id, value, label, description, sort_order, is_active, ref_value_id))",
    )
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: error.message, code: "QUERY_FAILED" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defs: CategoryFieldDef[] = (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((row: any) => row.catalog_fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => {
      const def = mapDefinition(row.catalog_fields);
      const options = sortOptions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row.catalog_fields.catalog_field_options ?? []).map(mapOption).filter((o: AttributeOption) => o.isActive),
      );
      return {
        ...def,
        appliesTo: row.applies_to,
        isRequired: row.is_required ?? false,
        sortOrder: row.sort_order ?? 0,
        options,
      };
    });
  return { success: true, data: defs };
}

/**
 * Get the options for one attribute, identified by its `key` (field_key).
 * Returns active options by default, sorted; pass `includeInactive` for all.
 */
export async function getOptions(
  db: DbClient,
  key: string,
  opts?: { includeInactive?: boolean }
): Promise<ActionResult<AttributeOption[]>> {
  const fieldKey = normalizeKey(key);
  if (!fieldKey) return { success: false, error: "Attribute key is required", code: "VALIDATION_ERROR" };
  const c = db as DbClient;
  const { data, error } = await c
    .from("catalog_fields")
    .select("id, field_key, catalog_field_options(*)")
    .eq("field_key", fieldKey)
    .maybeSingle();
  if (error) return { success: false, error: error.message, code: "QUERY_FAILED" };
  if (!data) return { success: false, error: `Unknown attribute key: ${fieldKey}`, code: "NOT_FOUND" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let options: AttributeOption[] = (data.catalog_field_options ?? []).map(mapOption);
  if (!opts?.includeInactive) options = options.filter((o) => o.isActive);
  return { success: true, data: sortOptions(options) };
}

/**
 * Upsert one attribute option. Resolves the parent field from `fieldId` or
 * `key`. Full-service write so UI actions and MCP share one code path.
 */
export async function saveOption(db: DbClient, input: SaveAttributeOptionInput): Promise<ActionResult<AttributeOption>> {
  const c = db as DbClient;

  let fieldId = input.fieldId ?? null;
  if (!fieldId) {
    const fieldKey = normalizeKey(input.key);
    if (!fieldKey) return { success: false, error: "fieldId or key is required", code: "VALIDATION_ERROR" };
    const { data: field, error: fErr } = await c
      .from("catalog_fields")
      .select("id")
      .eq("field_key", fieldKey)
      .maybeSingle();
    if (fErr) return { success: false, error: fErr.message, code: "QUERY_FAILED" };
    if (!field) return { success: false, error: `Unknown attribute key: ${fieldKey}`, code: "NOT_FOUND" };
    fieldId = field.id;
  }

  if (!input.value || !input.label) {
    return { success: false, error: "value and label are required", code: "VALIDATION_ERROR" };
  }

  const payload = {
    field_id: fieldId,
    ref_value_id: input.refValueId ?? null,
    value: input.value,
    label: input.label,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };

  const result = input.id
    ? await c.from("catalog_field_options").update(payload).eq("id", input.id).select("*").single()
    : await c.from("catalog_field_options").insert(payload).select("*").single();

  if (result.error) {
    if (result.error.code === "23505") {
      return { success: false, error: `Option "${input.value}" already exists for this attribute`, code: "DUPLICATE" };
    }
    return { success: false, error: result.error.message, code: "WRITE_FAILED" };
  }
  return { success: true, data: mapOption(result.data) };
}
