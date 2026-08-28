"use server";

import { revalidatePath } from "next/cache";
import { requireVisibleProject } from "../../projects/actions/_projectAccess";
import { resolveProjectsViewer } from "../../projects/access";
import { updateProjectStageSchema } from "../schemas";
import { canViewerSelectStage, PROJECT_STAGE_COLUMNS, toStageOption } from "../reads";
import type { ActionResult, StageOption } from "../types";

export async function updateProjectStage(raw: unknown): Promise<ActionResult<{ stage: StageOption; updatedAt: string }>> {
  const parsed = updateProjectStageSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid stage change", code: "VALIDATION_ERROR" };
  const access = await requireVisibleProject(parsed.data.projectId);
  if (!access.ok) return { success: false, error: "Project unavailable", code: access.code };
  const viewer = await resolveProjectsViewer(access.actor);
  const { data: stageRow, error: stageError } = await access.actor.db.from("project_stages")
    .select(PROJECT_STAGE_COLUMNS).eq("key", parsed.data.stageKey).maybeSingle();
  if (stageError || !stageRow) return { success: false, error: "Stage unavailable", code: "STAGE_UNAVAILABLE" };
  const stage = toStageOption(stageRow);
  if (!canViewerSelectStage(stage, viewer)) return { success: false, error: "Stage unavailable for your role", code: "FORBIDDEN" };
  const { data, error } = await access.actor.db.from("orders").update({ lifecycle_stage: stage.key })
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
