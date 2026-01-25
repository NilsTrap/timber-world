"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/organisations/types";

/**
 * Complete Invite Action
 *
 * Called after a user clicks the invite link and sets their password.
 * 1. Verifies the user is authenticated (session from invite token)
 * 2. Updates the user's password in Supabase Auth
 * 3. Updates portal_users status to 'active'
 * 4. Returns redirect URL based on user's role
 */
export async function completeInvite(
  password: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await createClient();

  // 1. Get the current session (set by the client using the invite token)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Session expired. Please use your invitation link again.",
      code: "NO_SESSION",
    };
  }

  // 2. Update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password: password,
  });

  if (updateError) {
    console.error("Failed to update password:", updateError);
    return {
      success: false,
      error: updateError.message || "Failed to set password. Please try again.",
      code: "PASSWORD_UPDATE_FAILED",
    };
  }

  // 3. Get the portal_user to determine role and update status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser, error: portalUserError } = await (supabase as any)
    .from("portal_users")
    .select("id, role, status, organisation_id")
    .eq("auth_user_id", user.id)
    .single();

  if (portalUserError || !portalUser) {
    console.error("Failed to get portal user:", portalUserError);
    // User might not be linked yet - this shouldn't happen with proper invite flow
    return {
      success: false,
      error:
        "Account configuration error. Please contact your administrator.",
      code: "NO_PORTAL_USER",
    };
  }

  // 4. Update portal_users status to 'active' and set last_login_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: statusError } = await (supabase as any)
    .from("portal_users")
    .update({
      status: "active",
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", portalUser.id);

  if (statusError) {
    console.error("Failed to update portal user status:", statusError);
    // Non-critical - user can still log in, status will be updated on next login
  }

  // 5. Determine redirect based on role
  let redirectTo = "/dashboard";

  if (portalUser.role === "super_admin" || portalUser.role === "admin") {
    redirectTo = "/admin/organisations";
  } else if (portalUser.role === "producer") {
    redirectTo = "/production";
  }

  return {
    success: true,
    data: { redirectTo },
  };
}
