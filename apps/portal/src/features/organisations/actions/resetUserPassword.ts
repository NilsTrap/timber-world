"use server";

import { logAudit } from "@/features/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { ADMIN_DENIED } from "./_platformAdmin";
import { requirePersonOnboardingAccess } from "./_personOnboardingAccess";
import {
  passwordPayloadSchema,
  manualPasswordResetAuditMetadata,
  setManualPassword,
  type PasswordResetAdmin,
  type ResetUserPasswordPayload,
} from "../services/manualPasswordReset";

/**
 * Reset User Password
 *
 * Sets a new password for an active member after enforcing the exact company
 * boundary. The cleartext password is used only for the provider mutation.
 */
export async function resetUserPassword(
  userId: string,
  organisationId: string,
  payload: ResetUserPasswordPayload,
): Promise<ActionResult<Record<string, never>>> {
  if (!isValidUUID(userId) || !isValidUUID(organisationId)) return ADMIN_DENIED;
  const parsed = passwordPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: "Enter matching passwords of at least 8 characters", code: "VALIDATION_ERROR" };
  }

  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  const admin = createAdminClient();
  const reset = await setManualPassword(
    admin as unknown as PasswordResetAdmin,
    userId,
    organisationId,
    parsed.data.password,
    guard.mode === "admin",
  );
  if (!reset.ok && reset.code === "NO_AUTH_USER") {
    return {
      success: false,
      error: "This user does not have login credentials yet. Use Send Credentials instead.",
      code: "NO_AUTH_USER",
    };
  }
  if (!reset.ok && reset.code === "RESET_FAILED") {
    return { success: false, error: "Password could not be updated; try again", code: "RESET_FAILED" };
  }
  if (!reset.ok) return ADMIN_DENIED;
  await logAudit({
    action: "portal_user.password_set",
    resourceType: "portal_user",
    resourceId: userId,
    organisationId,
    metadata: manualPasswordResetAuditMetadata,
  });
  return { success: true, data: {} };
}
