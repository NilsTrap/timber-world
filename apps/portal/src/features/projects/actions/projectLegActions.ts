"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { getOrderDeal } from "../../orders/services/orderDeals";
import { resolveProjectsActor } from "../access";

const uuid = z.string().uuid();
const createSchema = z.object({
  sourceProjectId: uuid,
  buyerOrganisationId: uuid.nullable(),
  sellerOrganisationId: uuid.nullable(),
  workPackages: z.array(z.object({ originLineItemId: uuid, quantity: z.coerce.number().positive() })).min(1),
}).refine((value) => value.buyerOrganisationId || value.sellerOrganisationId, "At least one party is required")
  .refine((value) => !value.buyerOrganisationId || !value.sellerOrganisationId || value.buyerOrganisationId !== value.sellerOrganisationId, "Buyer and seller must differ");

function stableRpcError(message: string): { error: string; code: string } {
  const normalized = message.replaceAll("_", " ");
  if (/not draft/i.test(normalized)) return { error: "The project must be a draft", code: "NOT_DRAFT" };
  if (/forbidden|platform admin/i.test(normalized)) return { error: "Not allowed", code: "FORBIDDEN" };
  if (/not found|canonical origin|origin ambiguous/i.test(normalized)) return { error: "Project specification is unavailable", code: "NOT_FOUND" };
  if (/self.?deal|must differ/i.test(normalized)) return { error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (/allocat|quantity|eligible|inactive/i.test(normalized)) return { error: "The selected work package or party is no longer available", code: "CONFLICT" };
  return { error: "Could not update the project leg", code: "UPDATE_FAILED" };
}

export async function createSameSpineProjectLeg(raw: unknown): Promise<ActionResult<{ projectId: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid project leg", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor();
  if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  if (!actor.isPlatformAdmin) {
    const source = await getOrderDeal(actor.db, actor.actor, parsed.data.sourceProjectId);
    const traderOwnsSource = source.success
      && source.data.seller.id === actor.orgId
      && parsed.data.buyerOrganisationId === actor.orgId
      && parsed.data.sellerOrganisationId === null;
    if (!traderOwnsSource) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  }
  const { data, error } = await actor.db.rpc("create_same_spine_project_leg", {
    p_source_order_id: parsed.data.sourceProjectId,
    p_buyer_id: parsed.data.buyerOrganisationId,
    p_seller_id: parsed.data.sellerOrganisationId,
    p_work_packages: parsed.data.workPackages.map((item) => ({ origin_line_item_id: item.originLineItemId, quantity: item.quantity })),
  });
  if (error) return { success: false, ...stableRpcError(error.message) };
  const projectId = String(data);
  revalidatePath(`/projects/${parsed.data.sourceProjectId}`);
  return { success: true, data: { projectId } };
}

export async function completeProjectLegParty(raw: unknown): Promise<ActionResult<{ projectId: string }>> {
  const parsed = z.object({ projectId: uuid, side: z.enum(["buyer", "seller"]), organisationId: uuid }).safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid party selection", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor();
  if (!actor.ok || !actor.isPlatformAdmin) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data, error } = await actor.db.rpc("complete_project_leg_party", { p_order_id: parsed.data.projectId, p_side: parsed.data.side, p_organisation_id: parsed.data.organisationId });
  if (error) return { success: false, ...stableRpcError(error.message) };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  const payload = data as { orderId?: string } | string | null;
  return { success: true, data: { projectId: typeof payload === "string" ? payload : payload?.orderId ?? parsed.data.projectId } };
}
