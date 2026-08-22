import type { getOrderDeal } from "../../orders/services/orderDeals";
import { isValidUUID } from "../../orders/types";
import type { ProjectsActor } from "../access";
import { isPartyOrg } from "../projection";

export type AllowedProjectsActor = Extract<ProjectsActor, { ok: true }>;

export interface VisibleProjectDependencies {
  resolveActor: () => Promise<ProjectsActor>;
  getDeal: typeof getOrderDeal;
}

export type VisibleProjectResult =
  | { ok: true; actor: AllowedProjectsActor }
  | { ok: false; error: string; code: "NOT_FOUND" | "FORBIDDEN" };

/**
 * Production project boundary with injectable fact loaders for deterministic
 * acceptance tests. Tests supply rows, not policy decisions: malformed IDs,
 * actor denial, bilateral-party visibility, and write rights remain here.
 */
export async function requireVisibleProjectWith(
  projectId: string,
  write: boolean,
  dependencies: VisibleProjectDependencies,
): Promise<VisibleProjectResult> {
  if (!isValidUUID(projectId)) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  const actor = await dependencies.resolveActor();
  if (!actor.ok) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  const deal = await dependencies.getDeal(actor.db, actor.actor, projectId);
  if (!deal.success) return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  if (!actor.isPlatformAdmin && !isPartyOrg(deal.data, actor.orgId)) {
    return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  }
  if (write && !actor.isPlatformAdmin && !actor.profile.actions.has("deal:create")) {
    return { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
  }
  return { ok: true, actor };
}
