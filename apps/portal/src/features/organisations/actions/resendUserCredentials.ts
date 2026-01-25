"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Resend User Credentials (Invite Flow)
 *
 * Resends an invite for a portal user with status='invited' who already has auth_user_id:
 * 1. Verify user is in 'invited' status and has auth_user_id
 * 2. Generate a new invite link via Supabase Auth
 * 3. Supabase sends the email automatically
 * 4. Update invited_at timestamp
 *
 * The user receives an email with a magic link to set their password.
 *
 * Super Admin only endpoint.
 *
 * Note: Supabase free tier has a limit of 4 emails/hour.
 */
export async function resendUserCredentials(
  userId: string,
  organisationId: string
): Promise<ActionResult<{ email: string }>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check Super Admin role
  if (!isSuperAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate IDs
  if (!isValidUUID(userId)) {
    return {
      success: false,
      error: "Invalid user ID",
      code: "INVALID_ID",
    };
  }

  if (!isValidUUID(organisationId)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();

  // 4. Get the user from portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser, error: userError } = await (supabase as any)
    .from("portal_users")
    .select("id, email, name, role, organisation_id, auth_user_id, status")
    .eq("id", userId)
    .eq("organisation_id", organisationId)
    .single();

  if (userError || !portalUser) {
    return {
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  // 5. Check if user has status 'invited' and has auth_user_id
  if (portalUser.status !== "invited") {
    return {
      success: false,
      error: "User is not in invited status. Use Reset Password for active users.",
      code: "INVALID_STATUS",
    };
  }

  if (!portalUser.auth_user_id) {
    return {
      success: false,
      error: "User does not have login credentials yet. Use Send Credentials instead.",
      code: "NO_AUTH_USER",
    };
  }

  // 6. Delete the existing auth user and create a fresh invite
  // Supabase doesn't allow re-inviting an existing email, so we delete and recreate
  const supabaseAdmin = createAdminClient();

  // Delete the old auth user
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    portalUser.auth_user_id as string
  );

  if (deleteError) {
    console.error("Failed to delete old auth user:", deleteError);
    return {
      success: false,
      error: "Failed to reset user credentials. Please try again.",
      code: "DELETE_FAILED",
    };
  }

  // Get organisation name for metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .single();

  const organisationName = org?.name || "Timber World";

  // Create a fresh invite
  const { data: authData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(portalUser.email as string, {
      data: {
        name: portalUser.name as string,
        role: portalUser.role as string,
        organisation_name: organisationName,
      },
      redirectTo: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite`
        : undefined,
    });

  if (inviteError || !authData.user) {
    console.error("Failed to resend invite:", inviteError);

    if (inviteError?.message?.includes("rate limit") || inviteError?.message?.includes("exceeded")) {
      return {
        success: false,
        error: "Email rate limit reached. Supabase allows 4 invites per hour. Please try again later.",
        code: "RATE_LIMITED",
      };
    }

    return {
      success: false,
      error: inviteError?.message || "Failed to resend invite email",
      code: "INVITE_FAILED",
    };
  }

  // 7. Update auth_user_id and invited_at timestamp in portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("portal_users")
    .update({
      auth_user_id: authData.user.id,
      invited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update invited_at:", updateError);
    // Invite was sent but timestamp update failed - this is not critical
  }

  return {
    success: true,
    data: { email: portalUser.email as string },
  };
}
