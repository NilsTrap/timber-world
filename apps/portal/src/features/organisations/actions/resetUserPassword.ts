"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

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
      redirectTo: "https://timber-world-portal.vercel.app/accept-invite",
    }
  );

  if (resetError) {
    console.error("Failed to send password reset:", resetError);

    if (resetError.message?.includes("rate limit") || resetError.message?.includes("exceeded")) {
      return {
        success: false,
        error: "Email rate limit reached. Supabase allows 4 emails per hour. Please try again later.",
        code: "RATE_LIMITED",
      };
    }

    return {
      success: false,
      error: resetError.message || "Failed to send password reset email",
      code: "RESET_FAILED",
    };
  }

  // 7. Update updated_at timestamp in portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("portal_users")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return {
    success: true,
    data: { email: portalUser.email as string },
  };
}
