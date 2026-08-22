"use server";

import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@timber/config";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logAudit } from "@/features/audit/logAudit";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

/**
 * Reset User Password
 *
 * Sends a password reset email for a portal user:
 * 1. Verify user has auth_user_id
 * 2. Send password reset email via Supabase Auth
 * 3. User receives email with link to set new password
 *
 * Super Admin only endpoint.
 *
 * Note: Supabase free tier has a limit of 4 emails/hour.
 */
export async function resetUserPassword(
  userId: string,
  organisationId: string
): Promise<ActionResult<{ email: string }>> {
  // 1. Check authentication
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;

  // 3. Validate IDs
  if (!isValidUUID(userId)) {
    return ADMIN_DENIED;
  }

  if (!isValidUUID(organisationId)) {
    return ADMIN_DENIED;
  }

  const supabase = await createClient();

  // 4. Get the user from portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser, error: userError } = await (supabase as any)
    .from("portal_users")
    .select("id, email, name, role, organisation_id, auth_user_id, status")
    .eq("id", userId)
    .single();

  if (userError || !portalUser) {
    return {
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  // 5. Check if user has auth_user_id
  if (!portalUser.auth_user_id) {
    return {
      success: false,
      error: "User does not have login credentials yet. Use Send Credentials instead.",
      code: "NO_AUTH_USER",
    };
  }

  // 6. Send password reset email via Supabase Auth
  // Note: Using resetPasswordForEmail which actually sends the email
  // (generateLink only generates a link without sending)
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    portalUser.email as string,
    {
      redirectTo: `${siteConfig.url.replace(/\/$/, "")}/accept-invite`,
    }
  );

  if (resetError) {
    return { success: false, error: "Passwordless reset email could not be sent; try again", code: "RESET_FAILED" };
  }

  // 7. Update updated_at timestamp in portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("portal_users")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // Audit the EVENT only — no password/secret is involved (this sends a reset link).
  await logAudit({
    action: "portal_user.password_reset_sent",
    resourceType: "portal_user",
    resourceId: userId,
    organisationId,
    metadata: { email: portalUser.email, method: "reset_email" },
  });

  return {
    success: true,
    data: { email: portalUser.email as string },
  };
}
