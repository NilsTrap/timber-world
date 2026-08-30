"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { getOrderDeal } from "../../orders/services/orderDeals";
import type { ActorContext, DbClient } from "../../orders/services/dealModel";
import { resolveProjectsActor } from "../access";
import { validQuantityForUnit } from "../services/specificationQuantity";
import {
  calculateComponentTotalCents,
  canEditProjectSpecification,
  projectSpecificationEditDenialCode,
} from "../services/projectSpecification";
import { specificationLineUpdate } from "../services/specificationLineEdit";
import {
  structuredSpecificationPayload,
  structuredSpecificationValuesSchema,
} from "../services/specificationStructuredValues";

const uuid = z.string().uuid();
const lineUnit = z.enum(["kg", "m3", "m2", "piece", "linear_m", "package", "crate", "loose_m3"]);
const componentType = z.enum(["material", "process", "service"]);
const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().nonnegative();

const lineSchema = z.object({
  projectId: uuid,
  lineId: uuid.optional(),
  productName: z.string().trim().min(1).max(200),
  quantity: positiveNumber,
  unit: lineUnit,
  notes: z.string().trim().max(2000).optional().default(""),
  catalogVariantId: uuid.optional(),
});

const componentSchema = z.object({
  projectId: uuid,
  lineId: uuid,
  componentId: uuid.optional(),
  type: componentType,
  name: z.string().trim().min(1).max(200),
  quantity: positiveNumber,
  unit: z.string().trim().min(1).max(30),
  unitCost: nonNegativeNumber,
});

type EditableContext = {
  db: DbClient;
  actor: ActorContext;
};

async function editableProject(projectId: string): Promise<ActionResult<EditableContext>> {
  const a = await resolveProjectsActor();
  if (!a.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const deal = await getOrderDeal(a.db, a.actor, projectId);
  if (!deal.success) return { success: false, error: "Project not found", code: "NOT_FOUND" };
  const allowed = canEditProjectSpecification({
    isPlatformAdmin: a.isPlatformAdmin,
    actorOrganisationId: a.orgId,
    sellerOrganisationId: deal.data.seller.id,
    dealTermsEditable: a.access.domainEditable("deal_terms"),
    lifecycleStage: deal.data.lifecycleStage,
    dealKind: deal.data.dealKind,
  });
  if (!allowed) {
    const code = projectSpecificationEditDenialCode({
      isPlatformAdmin: a.isPlatformAdmin,
      actorOrganisationId: a.orgId,
      sellerOrganisationId: deal.data.seller.id,
      dealTermsEditable: a.access.domainEditable("deal_terms"),
      lifecycleStage: deal.data.lifecycleStage,
      dealKind: deal.data.dealKind,
    }) ?? "FORBIDDEN";
    return {
      success: false,
      error: code === "NOT_DRAFT" ? "Specification can only be changed while the project is a draft" : "Not allowed",
      code,
    };
  }
  return { success: true, data: { db: a.db, actor: a.actor } };
}

function refreshProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/orders/${projectId}`);
}

function lineQuantities(unit: z.infer<typeof lineUnit>, quantity: number) {
  return unit === "m3" || unit === "loose_m3"
    ? { pieces: null, volume_m3: quantity }
    : { pieces: String(quantity), volume_m3: null };
}

function mapCatalogLineRpcError(message: string): ActionResult<never> {
  if (message.includes("BASIC_SNAPSHOT_TOO_LARGE")) return { success: false, error: "Catalogue field values exceed the supported limits", code: "VALIDATION_ERROR" };
  if (message.includes("REQUIRED_PROCESS_VALUE_MISSING")) return { success: false, error: "A required process value is missing from the catalogue product", code: "VALIDATION_ERROR" };
  if (message.includes("INVALID_QUANTITY_FOR_UNIT")) return { success: false, error: "Quantity is outside the allowed range for this unit", code: "VALIDATION_ERROR" };
  if (message.includes("CATALOG_UNIT_MISMATCH")) return { success: false, error: "The selected unit does not match the catalogue category", code: "VALIDATION_ERROR" };
  if (message.includes("UNSUPPORTED_PROCESS_FIELD_TYPE")) return { success: false, error: "This category contains an unsupported process field type", code: "VALIDATION_ERROR" };
  if (message.includes("TOO_MANY_PROCESS_FIELDS") || message.includes("PROCESS_VALUE_TOO_LONG")) return { success: false, error: "Catalogue process requirements exceed the supported limits", code: "VALIDATION_ERROR" };
  if (message.includes("CATALOG_VARIANT_INVALID") || message.includes("CATALOG_PRODUCT_INVALID") || message.includes("CATALOG_CATEGORY_INVALID")) return { success: false, error: "Catalogue selection is missing or inactive", code: "VALIDATION_ERROR" };
  if (message.includes("PROJECT_NOT_DRAFT")) return { success: false, error: "Specification can only be changed while the project is a draft", code: "NOT_DRAFT" };
  if (message.includes("ROOT_PROJECT_REQUIRED")) return { success: false, error: "Specification lines can only be added to a root project", code: "FORBIDDEN" };
  if (message.includes("FORBIDDEN")) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  return { success: false, error: "Could not add specification line", code: "INSERT_FAILED" };
}

function mapStructuredValueRpcError(message: string): ActionResult<never> {
  if (message.includes("PROJECT_NOT_DRAFT")) return { success: false, error: "Specification can only be changed while the project is a draft", code: "NOT_DRAFT" };
  if (message.includes("ROOT_PROJECT_REQUIRED") || message.includes("LINE_NOT_EDITABLE")) return { success: false, error: "Only catalogue fields on the original specification can be changed", code: "FORBIDDEN" };
  if (message.includes("STALE_SPECIFICATION")) return { success: false, error: "The specification changed; refresh and try again", code: "CONFLICT" };
  if (message.includes("BASIC_SNAPSHOT_TOO_LARGE")) return { success: false, error: "Catalogue field values exceed the supported limits", code: "VALIDATION_ERROR" };
  if (message.includes("FORBIDDEN")) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  if (message.includes("INVALID_")) return { success: false, error: "Structured specification values are invalid or out of date", code: "VALIDATION_ERROR" };
  return { success: false, error: "Could not update specification fields", code: "UPDATE_FAILED" };
}

export async function createProjectSpecificationLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = lineSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid line", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  if (!validQuantityForUnit(input.unit, input.quantity)) return { success: false, error: "Quantity is outside the allowed range for this unit", code: "VALIDATION_ERROR" };
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  let snapshot: Record<string, unknown> = { product_name: input.productName, unit: input.unit, notes: input.notes || null, is_standard: false };
  if (input.catalogVariantId) {
    const { data: variant, error: catalogError } = await ctx.data.db.from("catalog_variants")
      .select("id, product_id, sku, thickness_mm, width_mm, length_mm, is_active, catalog_products!inner(id, name, is_active, category_id, catalog_categories!inner(primary_unit, is_active))")
      .eq("id", input.catalogVariantId).eq("is_active", true).eq("catalog_products.is_active", true).eq("catalog_products.catalog_categories.is_active", true).maybeSingle();
    if (catalogError || !variant) return { success: false, error: "Catalogue selection is missing or inactive", code: "VALIDATION_ERROR" };
    const row = variant as Record<string, unknown>;
    const product = row.catalog_products as Record<string, unknown>;
    const category = product.catalog_categories as Record<string, unknown>;
    const catalogUnit = lineUnit.safeParse(category.primary_unit);
    if (!catalogUnit.success) return { success: false, error: "Catalogue unit is not supported by project specifications", code: "VALIDATION_ERROR" };
    const snapshotNotes = input.notes;
    if (snapshotNotes.length > 2000) {
      return { success: false, error: "Catalogue details exceed the specification note limit", code: "VALIDATION_ERROR" };
    }
    snapshot = {
      product_name: product.name as string,
      product_type: row.sku as string | null,
      thickness: row.thickness_mm == null ? null : String(row.thickness_mm),
      width: row.width_mm == null ? null : String(row.width_mm),
      length: row.length_mm == null ? null : String(row.length_mm),
      unit: catalogUnit.data,
      notes: snapshotNotes || null,
      catalog_product_id: row.product_id as string,
      catalog_variant_id: row.id as string,
      is_standard: true,
    };
  }
  const resolvedUnit = snapshot.unit as z.infer<typeof lineUnit>;
  const quantity = lineQuantities(resolvedUnit, input.quantity);
  if (!input.catalogVariantId) {
    const { data: rows, error: readError } = await ctx.data.db.from("order_line_items").select("line_no").eq("order_id", input.projectId).eq("side", "sell");
    if (readError) return { success: false, error: readError.message, code: "FETCH_FAILED" };
    const lineNo = (rows ?? []).reduce((max: number, row: { line_no?: number }) => Math.max(max, row.line_no ?? 0), 0) + 1;
    const { data, error } = await ctx.data.db.from("order_line_items").insert({
      order_id: input.projectId, side: "sell", line_no: lineNo,
      ...snapshot, unit_price_cents: null, line_total_cents: null, ...quantity,
    }).select("id").single();
    if (error || !data) return { success: false, error: error?.message ?? "Could not add line", code: "INSERT_FAILED" };
    refreshProject(input.projectId);
    return { success: true, data: { id: data.id as string } };
  }
  const { data, error } = await ctx.data.db.rpc("create_project_specification_line_with_snapshot", {
    p_order_id: input.projectId,
    p_catalog_variant_id: input.catalogVariantId,
    p_quantity: input.quantity,
    p_unit: resolvedUnit,
    p_notes: snapshot.notes ?? null,
  });
  if (error) return mapCatalogLineRpcError(error.message ?? "");
  if (!data) return { success: false, error: "Could not add specification line", code: "INSERT_FAILED" };
  refreshProject(input.projectId);
  return { success: true, data: { id: data as string } };
}

export type ProjectCatalogOption = { id: string; label: string; unit: string };

export async function getProjectCatalogOptions(): Promise<ActionResult<ProjectCatalogOption[]>> {
  const a = await resolveProjectsActor();
  if (!a.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data, error } = await a.db.from("catalog_variants")
    .select("id, sku, thickness_mm, width_mm, length_mm, is_active, catalog_products!inner(name, is_active, catalog_categories!inner(primary_unit, is_active))")
    .eq("is_active", true).eq("catalog_products.is_active", true).eq("catalog_products.catalog_categories.is_active", true).order("sort_order");
  if (error) return { success: false, error: "Could not load catalogue", code: "FETCH_FAILED" };
  const options = ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const product = row.catalog_products as Record<string, unknown>;
    const category = product.catalog_categories as Record<string, unknown>;
    const unit = lineUnit.safeParse(category.primary_unit);
    if (!unit.success) return [];
    const dimensions = [row.thickness_mm, row.width_mm, row.length_mm].filter((value) => value != null).join(" × ");
    return [{ id: row.id as string, unit: unit.data, label: `${product.name as string}${row.sku ? ` · ${row.sku as string}` : ""}${dimensions ? ` · ${dimensions}` : ""}` }];
  });
  return { success: true, data: options };
}

export async function updateProjectSpecificationLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = lineSchema.extend({ lineId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid line", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  const { data: existing, error: existingError } = await ctx.data.db
    .from("order_line_items")
    .select("catalog_product_id, unit")
    .eq("id", input.lineId)
    .eq("order_id", input.projectId)
    .maybeSingle();
  if (existingError) return { success: false, error: existingError.message, code: "FETCH_FAILED" };
  if (!existing) return { success: false, error: "Line not found", code: "NOT_FOUND" };

  const isCatalogSnapshot = Boolean(existing.catalog_product_id);
  const persistedUnit = isCatalogSnapshot ? lineUnit.safeParse(existing.unit) : null;
  if (persistedUnit && !persistedUnit.success) return { success: false, error: "Line unit is not supported", code: "VALIDATION_ERROR" };
  const resolvedUnit = persistedUnit?.success ? persistedUnit.data : input.unit;
  if (!validQuantityForUnit(resolvedUnit, input.quantity)) return { success: false, error: "Quantity is outside the allowed range for this unit", code: "VALIDATION_ERROR" };
  const quantity = lineQuantities(resolvedUnit, input.quantity);
  const update = specificationLineUpdate(isCatalogSnapshot, {
    productName: input.productName,
    unit: input.unit,
    notes: input.notes,
    quantityFields: quantity,
  });
  const updateQuery = ctx.data.db.from("order_line_items").update(update)
    .eq("id", input.lineId).eq("order_id", input.projectId).eq("side", "sell");
  const guardedUpdate = isCatalogSnapshot
    ? updateQuery.not("catalog_product_id", "is", null).eq("unit", resolvedUnit)
    : updateQuery.is("catalog_product_id", null);
  const { data, error } = await guardedUpdate.select("id").maybeSingle();
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  if (!data) return { success: false, error: "Line changed; refresh and try again", code: "CONFLICT" };
  refreshProject(input.projectId);
  return { success: true, data: { id: input.lineId } };
}

export async function updateProjectSpecificationStructuredValues(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = structuredSpecificationValuesSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid specification fields", code: "VALIDATION_ERROR" };
  const ctx = await editableProject(parsed.data.projectId);
  if (!ctx.success) return ctx;
  const { error } = await ctx.data.db.rpc(
    "update_project_specification_structured_values",
    structuredSpecificationPayload(parsed.data),
  );
  if (error) return mapStructuredValueRpcError(error.message ?? "");
  refreshProject(parsed.data.projectId);
  return { success: true, data: { id: parsed.data.lineId } };
}

export async function deleteProjectSpecificationLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ projectId: uuid, lineId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid line", code: "VALIDATION_ERROR" };
  const ctx = await editableProject(parsed.data.projectId);
  if (!ctx.success) return ctx;
  const { data, error } = await ctx.data.db.from("order_line_items").delete().eq("id", parsed.data.lineId).eq("order_id", parsed.data.projectId).select("id").maybeSingle();
  if (error) return { success: false, error: error.message, code: "DELETE_FAILED" };
  if (!data) return { success: false, error: "Line not found", code: "NOT_FOUND" };
  refreshProject(parsed.data.projectId);
  return { success: true, data: { id: parsed.data.lineId } };
}

async function lineBelongsToProject(db: DbClient, projectId: string, lineId: string): Promise<boolean> {
  const { data } = await db.from("order_line_items").select("id").eq("id", lineId).eq("order_id", projectId).maybeSingle();
  return Boolean(data);
}

export async function createProjectLineComponent(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid cost", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  if (!(await lineBelongsToProject(ctx.data.db, input.projectId, input.lineId))) return { success: false, error: "Line not found", code: "NOT_FOUND" };
  const { data: rows, error: sortError } = await ctx.data.db.from("order_line_item_components").select("sort_order").eq("order_line_item_id", input.lineId);
  if (sortError) return { success: false, error: sortError.message, code: "FETCH_FAILED" };
  const sortOrder = (rows ?? []).reduce((max: number, row: { sort_order?: number }) => Math.max(max, row.sort_order ?? 0), 0) + 10;
  const { data, error } = await ctx.data.db.from("order_line_item_components").insert({
    order_line_item_id: input.lineId, component_type: input.type, name: input.name,
    quantity: input.quantity, unit: input.unit, unit_cost: input.unitCost,
    total_cost_cents: calculateComponentTotalCents(input.quantity, input.unitCost), sort_order: sortOrder,
  }).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Could not add cost", code: "INSERT_FAILED" };
  refreshProject(input.projectId);
  return { success: true, data: { id: data.id as string } };
}

export async function updateProjectLineComponent(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.extend({ componentId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid cost", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  if (!(await lineBelongsToProject(ctx.data.db, input.projectId, input.lineId))) return { success: false, error: "Line not found", code: "NOT_FOUND" };
  const { data, error } = await ctx.data.db.from("order_line_item_components").update({
    component_type: input.type, name: input.name, quantity: input.quantity, unit: input.unit,
    unit_cost: input.unitCost, total_cost_cents: calculateComponentTotalCents(input.quantity, input.unitCost),
  }).eq("id", input.componentId).eq("order_line_item_id", input.lineId).select("id").maybeSingle();
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  if (!data) return { success: false, error: "Cost not found", code: "NOT_FOUND" };
  refreshProject(input.projectId);
  return { success: true, data: { id: input.componentId } };
}

export async function deleteProjectLineComponent(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ projectId: uuid, lineId: uuid, componentId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid cost", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  if (!(await lineBelongsToProject(ctx.data.db, input.projectId, input.lineId))) return { success: false, error: "Line not found", code: "NOT_FOUND" };
  const { data, error } = await ctx.data.db.from("order_line_item_components").delete().eq("id", input.componentId).eq("order_line_item_id", input.lineId).select("id").maybeSingle();
  if (error) return { success: false, error: error.message, code: "DELETE_FAILED" };
  if (!data) return { success: false, error: "Cost not found", code: "NOT_FOUND" };
  refreshProject(input.projectId);
  return { success: true, data: { id: input.componentId } };
}
