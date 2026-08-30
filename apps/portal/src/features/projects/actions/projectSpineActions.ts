"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../../orders/types";
import { resolveProjectsActor } from "../access";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Project title is required").max(160, "Project title is too long"),
  expectedTitle: z.string().nullable(),
});

export async function updateProjectSpineTitle(input: unknown): Promise<ActionResult<{ title: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid project title", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor();
  if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data: spineId, error } = await actor.db.rpc("update_project_spine_title", {
    p_project_id: parsed.data.projectId,
    p_title: parsed.data.title,
    p_expected_title: parsed.data.expectedTitle,
  });
  if (error || !spineId) {
    const forbidden = error?.message.includes("FORBIDDEN");
    const stale = error?.message.includes("STALE_TITLE");
    return { success: false, error: forbidden ? "Not allowed" : stale ? "The project title changed. Refresh and try again." : "Could not update project title", code: forbidden ? "FORBIDDEN" : stale ? "CONFLICT" : "UPDATE_FAILED" };
  }
  const { data: legsData } = await createAdminClient().from("orders").select("id").eq("spine_id", spineId);
  const legs = (legsData ?? []) as Array<{ id: string }>;
  for (const leg of legs) revalidatePath(`/projects/${leg.id}`);
  revalidatePath("/projects");
  return { success: true, data: { title: parsed.data.title } };
}
