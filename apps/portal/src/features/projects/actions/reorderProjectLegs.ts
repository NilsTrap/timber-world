"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { resolveProjectsActor } from "../access";

const inputSchema = z.object({
  spineId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function reorderProjectLegs(input: unknown): Promise<ActionResult<null>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || new Set(parsed.data.orderIds).size !== parsed.data.orderIds.length) {
    return { success: false, error: "Invalid leg order", code: "VALIDATION_ERROR" };
  }
  const actor = await resolveProjectsActor();
  if (!actor.ok || !actor.isPlatformAdmin) return { success: false, error: "Not permitted", code: "FORBIDDEN" };
  const { error } = await actor.db.rpc("reorder_project_spine_legs", {
    p_spine_id: parsed.data.spineId,
    p_order_ids: parsed.data.orderIds,
  });
  if (error) return { success: false, error: "Could not reorder project legs", code: "UPDATE_FAILED" };
  revalidatePath("/projects");
  return { success: true, data: null };
}
