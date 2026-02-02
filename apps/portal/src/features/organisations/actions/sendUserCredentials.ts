"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Send User Credentials (Invite Flow)
 *
 * Invites a portal user using Supabase's built-in invite system:
 * 1. Send invite email via Supabase Auth (user sets their own password)
 * 2. Link auth_user_id in portal_users table
 * 3. Update status from 'created' to 'invited'
 * 4. Set invited_at and invited_by
 *
 * The user receives an email with a magic link to set their password.
 *
 * Super Admin only endpoint.
 *
 * Note: Supabase free tier has a limit of 4 emails/hour.
 */
export async function sendUserCredentials(
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

  // 5. Check if user already has auth credentials
  if (portalUser.auth_user_id) {
    return {
      success: false,
      error: "User already has login credentials. Use 'Resend' to send a new invite.",
      code: "ALREADY_HAS_CREDENTIALS",
    };
  }

  // 6. Get organisation name for metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .single();

  const organisationName = org?.name || "Timber World";

  // 7. Get current admin's portal_users ID for invited_by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentAdmin } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", session.id)
    .single();

  const invitedById = currentAdmin?.id ?? null;

  // 8. Invite user via Supabase Auth Admin API
  // This sends an email with a magic link for the user to set their password
  const supabaseAdmin = createAdminClient();
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(portalUser.email as string, {
      data: {
        name: portalUser.name as string,
        role: portalUser.role as string,
        organisation_name: organisationName,
      },
      redirectTo: "https://timber-world-portal.vercel.app/accept-invite",
    });

  if (authError || !authData.user) {
    console.error("Failed to invite user:", authError);

    // Check for specific error types
    if (authError?.message?.includes("already been registered")) {
      return {
        success: false,
        error: "Email already registered. The user may already have an account.",
        code: "EMAIL_EXISTS_IN_AUTH",
      };
    }

    if (authError?.message?.includes("rate limit") || authError?.message?.includes("exceeded")) {
      return {
        success: false,
        error: "Email rate limit reached. Supabase allows 4 invites per hour. Please try again later.",
        code: "RATE_LIMITED",
      };
    }

    return {
      success: false,
      error: authError?.message || "Failed to send invite email",
      code: "INVITE_FAILED",
    };
  }

  // 9. Link auth_user_id and update status to 'invited'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("portal_users")
    .update({
      auth_user_id: authData.user.id,
      status: "invited",
      invited_at: new Date().toISOString(),
      invited_by: invitedById,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to link auth user:", updateError);
    return {
      success: false,
      error: "Invite sent but failed to update user profile. Please contact support.",
      code: "LINK_FAILED",
    };
  }

  return {
    success: true,
    data: { email: portalUser.email as string },
  };
}
