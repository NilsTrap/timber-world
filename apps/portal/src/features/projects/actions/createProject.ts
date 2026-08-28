"use server";

import { createDeal } from "../../orders/services/orderDeals";
import type { DbClient } from "../../orders/services/dealModel";
import type { ActionResult } from "../../orders/types";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import type { ProjectCreateRole } from "../capabilities";

export interface CreateProjectInput {
  name: string;
  role: ProjectCreateRole;
  idempotencyKey: string;
}
export interface CreatedProject {
  id: string;
  reference: string;
  name: string;
}

async function resolveSingleLinkedTrader(
  db: DbClient,
  buyerOrganisationId: string,
): Promise<string | null> {
  const { data, error } = await db.rpc("project_single_linked_trader", {
    p_buyer_organisation_id: buyerOrganisationId,
  });
  return error || typeof data !== "string" ? null : data;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult<CreatedProject>> {
  const actor = await resolveProjectsActor();
  if (!actor.ok) return { success: false, error: "Project creation unavailable", code: "FORBIDDEN" };
  const name = input.name.normalize("NFC").trim();
  if (!name || name.length > 255) {
    return { success: false, error: "Enter a project name", code: "VALIDATION_ERROR" };
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    return { success: false, error: "Invalid creation request", code: "VALIDATION_ERROR" };
  }
  const viewer = await resolveProjectsViewer(actor);
  if (!viewer.canCreateProject || !viewer.createRoles.includes(input.role)) {
    return { success: false, error: "Project creation unavailable", code: "FORBIDDEN" };
  }

  const orgId = actor.orgId;
  const linkedTraderId = input.role === "buyer" && orgId
    ? await resolveSingleLinkedTrader(actor.db, orgId)
    : null;
  const deal = await createDeal(actor.db, actor.actor, {
    name,
    idempotencyKey: `project-${input.idempotencyKey}`,
    customerOrganisationId: input.role === "buyer" ? orgId : null,
    buyerOrganisationId: input.role === "buyer" ? orgId : null,
    sellerOrganisationId: input.role === "trader" ? orgId : linkedTraderId,
  });
  if (!deal.success) return deal as ActionResult<CreatedProject>;
  const { error: spineError } = await actor.db.rpc("ensure_project_origin_spine", {
    p_order_id: deal.data.id,
  });
  if (spineError) {
    return { success: false, error: "Could not create the project spine", code: "CREATE_FAILED" };
  }
  return {
    success: true,
    data: {
      id: deal.data.id,
      reference: deal.data.dealCode ?? deal.data.code,
      name,
    },
  };
}
