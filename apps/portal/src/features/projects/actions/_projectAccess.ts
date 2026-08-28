import { getOrderDeal } from "../../orders/services/orderDeals";
import { resolveProjectsActor } from "../access";
import {
  requireVisibleProjectWith,
  type VisibleProjectDependencies,
  type VisibleProjectResult,
} from "./_projectAuthorization";

export type { AllowedProjectsActor, VisibleProjectResult } from "./_projectAuthorization";

const productionDependencies: VisibleProjectDependencies = {
  resolveActor: resolveProjectsActor,
  getDeal: getOrderDeal,
};

export async function requireVisibleProject(
  projectId: string,
  write: boolean | "upload" = false,
): Promise<VisibleProjectResult> {
  return requireVisibleProjectWith(projectId, write, productionDependencies);
}
