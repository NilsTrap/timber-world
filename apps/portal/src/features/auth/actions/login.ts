"use server";

import { createClient } from "@/lib/supabase/server";
import { logLoginEvent } from "@/features/audit/actions/logLoginEvent";
import { loginSchema, type LoginInput } from "../schemas/login";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Log in a user with email and password.
 *
 * NOTE: This is a PUBLIC endpoint - no authentication required.
 * After successful login, returns redirect path for client to navigate.
 */
export async function loginUser(
  input: LoginInput
): Promise<ActionResult<{ redirectTo: string }>> {
  // 1. Validate input with Zod
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  // 2. Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // TODO: Remove this console.log before production
    console.error("Login error from Supabase:", error.message, error.code);
    // Generic error for security (don't reveal if email exists)
    return {
      success: false,
      error: "Invalid email or password",
      code: "INVALID_CREDENTIALS",
    };
  }

  if (!data.user) {
    return { success: false, error: "Login failed", code: "LOGIN_FAILED" };
  }

  // 3. Check portal_users record and verify user is active
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser } = await (supabase as any)
    .from("portal_users")
    .select("id, status, is_active")
    .eq("auth_user_id", data.user.id)
    .single();

  // 4. Block deactivated users
  if (portalUser && portalUser.is_active === false) {
    // Sign out the user since they successfully authenticated but are deactivated
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account has been deactivated. Please contact your administrator.",
      code: "ACCOUNT_DEACTIVATED",
    };
  }

  // 5. Handle first login - update status from 'invited' to 'active'
  // This happens when a user logs in for the first time after receiving credentials
  if (portalUser && portalUser.status === "invited") {
    // Update status to 'active' and record last login timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("portal_users")
      .update({
        status: "active",
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", portalUser.id);
  } else if (portalUser) {
    // Just update last_login_at for returning users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("portal_users")
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", portalUser.id);
  }

  // 5b. Record a login-history event (fire-and-forget; never blocks login).
  if (portalUser) {
    await logLoginEvent(portalUser.id, email);
  }

  // 6. Return redirect path
  // Note: Both roles redirect to /dashboard - role-specific UI handled in Story 1.4
  return {
    success: true,
    data: { redirectTo: "/dashboard" },
  };
}
