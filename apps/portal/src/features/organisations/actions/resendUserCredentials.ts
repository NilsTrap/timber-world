"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { sendPasswordlessInvite } from "../services/passwordlessInvite";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export async function resendUserCredentials(
  userId: string,
  organisationId: string,
): Promise<ActionResult<{ email: string }>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(userId) || !isValidUUID(organisationId)) return ADMIN_DENIED;
  const admin = createAdminClient();
  const result = await sendPasswordlessInvite(admin, admin, userId, organisationId, guard.session.portalUserId);
  if (!result.ok) {
    if (result.code === "ALREADY_ACTIVE") return { success: false, error: "This account is already active", code: result.code };
    return result.code === "MAIL_FAILED"
      ? { success: false, error: "Invitation email could not be sent; try again", code: result.code }
      : ADMIN_DENIED;
  }
  await logAudit({ action: "portal_user.invite_resend", resourceType: "portal_user", resourceId: userId, organisationId, metadata: { mode: result.mode } });
  return { success: true, data: { email: result.email } };
}
