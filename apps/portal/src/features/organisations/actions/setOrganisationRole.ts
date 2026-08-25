"use server";

import { createClient } from "@/lib/supabase/server";
import { updateTag } from "next/cache";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logAudit } from "@/features/audit/logAudit";
import {
  exclusiveRoleDbUpdate,
  isOrganisationRole,
  type OrganisationRole,
} from "../services/organisationRolePolicy";

/**
 * Set Organisation Role
 *
 * Selects one supply-chain role (or none). The database retains legacy boolean
 * columns, but all five are written atomically so a company can never gain a
 * second role through this action.
 */

export async function setOrganisationRole(
  id: string,
  role: OrganisationRole | null,
): Promise<ActionResult<{ role: OrganisationRole | null }>> {
  // 1. Validate input
  if (!id || !isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_INPUT",
    };
  }

  if (role !== null && !isOrganisationRole(role)) {
    return {
      success: false,
      error: "Invalid role",
      code: "INVALID_INPUT",
    };
  }

  // 2. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 3. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // 4. Update organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("organisations")
    .update(exclusiveRoleDbUpdate(role))
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to update organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation",
      code: "UPDATE_FAILED",
    };
  }

  // New persona organisations need the module ceiling that makes their
  // recommended Nilitto access group effective. Disabling a persona never
  // removes modules: another persona or an explicit admin configuration may
  // still rely on them.
  if (role) {
    const moduleCodes = ["dashboard.view", "projects.view"];
    if (role === "trader") {
      moduleCodes.push("counterparties.clients", "counterparties.suppliers");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: moduleError } = await (supabase as any)
      .from("organization_modules")
      .upsert(
        moduleCodes.map((moduleCode) => ({ organization_id: id, module_code: moduleCode, enabled: true })),
        { onConflict: "organization_id,module_code" },
      );
    if (moduleError) {
      console.error("Failed to configure organisation role modules:", moduleError);
      return {
        success: false,
        error: "Role saved but its navigation could not be configured",
        code: "UPDATE_FAILED",
      };
    }
    updateTag(`org-modules:${id}`);
  }

  await logAudit({
    action: "organisation.set_role",
    resourceType: "organisation",
    resourceId: id,
    organisationId: id,
    metadata: { role },
  });

  return {
    success: true,
    data: { role },
  };
}
