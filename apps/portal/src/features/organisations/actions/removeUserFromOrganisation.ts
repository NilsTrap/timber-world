"use server";

import type { ActionResult } from "../types";
import { setMembershipActive } from "./personMembershipAdmin";

/** Backward-compatible name: removal is a reversible membership deactivation. */
export async function removeUserFromOrganisation(
  userId: string,
  organisationId: string,
): Promise<ActionResult<{ userId: string; organisationId: string }>> {
  const result = await setMembershipActive(userId, organisationId, false);
  return result.success
    ? { success: true, data: { userId, organisationId } }
    : result;
}
