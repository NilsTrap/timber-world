"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVisibleProject } from "../../projects/actions/_projectAccess";
import { resolveProjectsViewer } from "../../projects/access";
import { updateProjectStageSchema } from "../schemas";
import { canViewerSelectStage, PROJECT_STAGE_COLUMNS, toStageOption } from "../reads";
import type { ActionResult, StageOption } from "../types";

export async function updateProjectStage(raw: unknown): Promise<ActionResult<{ stage: StageOption; updatedAt: string }>> {
  const parsed = updateProjectStageSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid stage change", code: "VALIDATION_ERROR" };
  const access = await requireVisibleProject(parsed.data.projectId, true);
  if (!access.ok) return { success: false, error: "Project unavailable", code: access.code };
  const viewer = await resolveProjectsViewer(access.actor);
  const { data: stageRow, error: stageError } = await access.actor.db.from("project_stages")
    .select(PROJECT_STAGE_COLUMNS).eq("key", parsed.data.stageKey).maybeSingle();
  if (stageError || !stageRow) return { success: false, error: "Stage unavailable", code: "STAGE_UNAVAILABLE" };
  const stage = toStageOption(stageRow);
  if (!canViewerSelectStage(stage, viewer)) return { success: false, error: "Stage unavailable for your role", code: "FORBIDDEN" };
  // Platform admins are authorized above at the application boundary. Use the
  // admin client for the write so tenant RLS does not block their global role.
  const updateDb = viewer.isPlatformAdmin ? createAdminClient() : access.actor.db;
  const { data, error } = await updateDb.from("orders").update({ lifecycle_stage: stage.key })
    .eq("id", parsed.data.projectId).eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("updated_at").maybeSingle();
  if (error) {
    const unavailable = error.message.includes("PROJECT_STAGE_UNAVAILABLE");
    const forbidden = error.message.includes("PROJECT_STAGE_FORBIDDEN");
    return {
      success: false,
      error: unavailable ? "Stage unavailable" : forbidden ? "Stage unavailable for your role" : "Could not update project stage",
      code: unavailable ? "STAGE_UNAVAILABLE" : forbidden ? "FORBIDDEN" : "UPDATE_FAILED",
    };
  }
  if (!data) return { success: false, error: "Project changed; reload and try again", code: "CONFLICT" };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath("/projects");
  return { success: true, data: { stage, updatedAt: (data as { updated_at: string }).updated_at } };
}
