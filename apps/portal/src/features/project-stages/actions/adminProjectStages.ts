"use server";

import { revalidatePath } from "next/cache";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DbClient } from "../../orders/services/dealModel";
import { createProjectStageSchema, reorderProjectStagesSchema, updateProjectStageDefinitionSchema } from "../schemas";
import { getProjectStages, PROJECT_STAGE_COLUMNS, toStageOption } from "../reads";
import type { ActionResult, StageOption } from "../types";

async function requireStageAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, result: { success: false as const, error: "Not authenticated", code: "UNAUTHENTICATED" } };
  if (!isPlatformAdmin(session)) return { ok: false as const, result: { success: false as const, error: "Permission denied", code: "FORBIDDEN" } };
  return { ok: true as const, db: await createClient() as DbClient };
}

export async function listProjectStages(): Promise<ActionResult<StageOption[]>> {
  const auth = await requireStageAdmin();
  if (!auth.ok) return auth.result;
  try { return { success: true, data: await getProjectStages(auth.db) }; }
  catch { return { success: false, error: "Could not load project stages", code: "QUERY_FAILED" }; }
}

export async function createProjectStage(raw: unknown): Promise<ActionResult<StageOption>> {
  const auth = await requireStageAdmin();
  if (!auth.ok) return auth.result;
  const parsed = createProjectStageSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid stage", code: "VALIDATION_ERROR" };
  const { data: tail, error: tailError } = await auth.db.from("project_stages").select("sort_order")
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (tailError) return { success: false, error: "Could not create project stage", code: "CREATE_FAILED" };
  const input = parsed.data;
  const { data, error } = await auth.db.from("project_stages").insert({
    key: input.key, label: input.label, color: input.color,
    sort_order: ((tail as { sort_order?: number } | null)?.sort_order ?? 0) + 10,
    is_active: input.isActive, available_to_buyer: input.availableToBuyer,
    available_to_trader: input.availableToTrader, available_to_supplier: input.availableToSupplier,
  }).select(PROJECT_STAGE_COLUMNS).single();
  if (error) return { success: false, error: error.code === "23505" ? "Stage key already exists" : "Could not create project stage", code: error.code === "23505" ? "DUPLICATE_KEY" : "CREATE_FAILED" };
  revalidatePath("/admin/settings/project-stages");
  return { success: true, data: toStageOption(data) };
}

export async function updateProjectStageDefinition(raw: unknown): Promise<ActionResult<StageOption>> {
  const auth = await requireStageAdmin();
  if (!auth.ok) return auth.result;
  const parsed = updateProjectStageDefinitionSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid stage", code: "VALIDATION_ERROR" };
  const input = parsed.data;
  const { data, error } = await auth.db.from("project_stages").update({
    label: input.label, color: input.color, is_active: input.isActive,
    available_to_buyer: input.availableToBuyer, available_to_trader: input.availableToTrader,
    available_to_supplier: input.availableToSupplier,
  }).eq("key", input.key).eq("updated_at", input.updatedAt).select(PROJECT_STAGE_COLUMNS).maybeSingle();
  if (error) return { success: false, error: "Could not update project stage", code: "UPDATE_FAILED" };
  if (!data) return { success: false, error: "Stage changed; reload and try again", code: "CONFLICT" };
  revalidatePath("/admin/settings/project-stages");
  revalidatePath("/projects");
  return { success: true, data: toStageOption(data) };
}

export async function reorderProjectStages(raw: unknown): Promise<ActionResult<true>> {
  const auth = await requireStageAdmin();
  if (!auth.ok) return auth.result;
  const parsed = reorderProjectStagesSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid order", code: "VALIDATION_ERROR" };
  const { error } = await auth.db.rpc("reorder_project_stages", { p_items: parsed.data.items });
  if (error) return { success: false, error: "Could not reorder project stages", code: "UPDATE_FAILED" };
  revalidatePath("/admin/settings/project-stages");
  return { success: true, data: true };
}
