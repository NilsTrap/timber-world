"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { sendPasswordlessInvite } from "../services/passwordlessInvite";
import { ADMIN_DENIED } from "./_platformAdmin";
import { requirePersonOnboardingAccess } from "./_personOnboardingAccess";

export async function sendUserCredentials(
  userId: string,
  organisationId: string,
): Promise<ActionResult<{ email: string }>> {
  if (!isValidUUID(userId) || !isValidUUID(organisationId)) return ADMIN_DENIED;
  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  const admin = createAdminClient();
  const result = await sendPasswordlessInvite(admin, admin, userId, organisationId, guard.session.portalUserId);
  if (!result.ok) {
    if (result.code === "ALREADY_ACTIVE") return { success: false, error: "This account is already active", code: result.code };
    return result.code === "MAIL_FAILED"
      ? { success: false, error: "Invitation email could not be sent; try again", code: result.code }
      : ADMIN_DENIED;
  }
  await logAudit({ action: "portal_user.invite", resourceType: "portal_user", resourceId: userId, organisationId, metadata: { mode: result.mode } });
  return { success: true, data: { email: result.email } };
}
