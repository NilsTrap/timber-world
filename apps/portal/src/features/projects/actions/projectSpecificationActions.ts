"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { getOrderDeal } from "../../orders/services/orderDeals";
import type { ActorContext, DbClient } from "../../orders/services/dealModel";
import { resolveProjectsActor } from "../access";
import {
  calculateComponentTotalCents,
  calculateLineTotalCents,
  canEditProjectSpecification,
} from "../services/projectSpecification";

const uuid = z.string().uuid();
const lineUnit = z.enum(["m3", "m2", "piece", "linear_m", "package", "crate", "loose_m3"]);
const componentType = z.enum(["material", "process", "service"]);
const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().nonnegative();

const lineSchema = z.object({
  projectId: uuid,
  lineId: uuid.optional(),
  productName: z.string().trim().min(1).max(200),
  quantity: positiveNumber,
  unit: lineUnit,
  unitPrice: nonNegativeNumber,
  notes: z.string().trim().max(2000).optional().default(""),
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
  });
  if (!allowed) {
    return {
      success: false,
      error: deal.data.lifecycleStage === "draft" ? "Not allowed" : "Specification can only be changed while the project is a draft",
      code: deal.data.lifecycleStage === "draft" ? "FORBIDDEN" : "NOT_DRAFT",
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

export async function createProjectSpecificationLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = lineSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid line", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  const { data: rows, error: readError } = await ctx.data.db.from("order_line_items").select("line_no").eq("order_id", input.projectId).eq("side", "sell");
  if (readError) return { success: false, error: readError.message, code: "FETCH_FAILED" };
  const lineNo = (rows ?? []).reduce((max: number, row: { line_no?: number }) => Math.max(max, row.line_no ?? 0), 0) + 1;
  const quantity = lineQuantities(input.unit, input.quantity);
  const { data, error } = await ctx.data.db.from("order_line_items").insert({
    order_id: input.projectId, side: "sell", line_no: lineNo,
    product_name: input.productName, unit: input.unit,
    unit_price_cents: Math.round(input.unitPrice * 100),
    line_total_cents: calculateLineTotalCents(input.quantity, input.unitPrice),
    notes: input.notes || null, ...quantity,
  }).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Could not add line", code: "INSERT_FAILED" };
  refreshProject(input.projectId);
  return { success: true, data: { id: data.id as string } };
}

export async function updateProjectSpecificationLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = lineSchema.extend({ lineId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid line", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const ctx = await editableProject(input.projectId);
  if (!ctx.success) return ctx;
  const quantity = lineQuantities(input.unit, input.quantity);
  const { data, error } = await ctx.data.db.from("order_line_items").update({
    product_name: input.productName, unit: input.unit,
    unit_price_cents: Math.round(input.unitPrice * 100),
    line_total_cents: calculateLineTotalCents(input.quantity, input.unitPrice),
    notes: input.notes || null, ...quantity,
  }).eq("id", input.lineId).eq("order_id", input.projectId).select("id").maybeSingle();
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  if (!data) return { success: false, error: "Line not found", code: "NOT_FOUND" };
  refreshProject(input.projectId);
  return { success: true, data: { id: input.lineId } };
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
