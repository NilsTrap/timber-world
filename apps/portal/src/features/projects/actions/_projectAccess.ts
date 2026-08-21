import { getOrderDeal } from "../../orders/services/orderDeals";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor, type ProjectsActor } from "../access";
import { isPartyOrg } from "../projection";

export type AllowedProjectsActor = Extract<ProjectsActor, { ok: true }>;

export async function requireVisibleProject(
  projectId: string,
  write = false,
): Promise<
  | { ok: true; actor: AllowedProjectsActor }
  | { ok: false; error: string; code: "NOT_FOUND" | "FORBIDDEN" }
> {
  if (!isValidUUID(projectId)) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  const actor = await resolveProjectsActor();
  if (!actor.ok) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  const deal = await getOrderDeal(actor.db, actor.actor, projectId);
  if (!deal.success) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  if (!actor.isPlatformAdmin && !isPartyOrg(deal.data, actor.orgId)) {
    return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  }
  if (write && !actor.isPlatformAdmin && !actor.profile.actions.has("deal:create")) {
    return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  }
  return { ok: true, actor };
}
