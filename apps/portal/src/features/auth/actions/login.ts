"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return {
        success: false,
        error: "Too many login attempts. Please wait a few minutes and try again.",
        code: "RATE_LIMITED",
      };
    }
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
  const { data: portalUser, error: portalUserError } = await (supabase as any)
    .from("portal_users")
    .select("id, status, is_active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (portalUserError || !portalUser) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account is not configured for the portal. Please contact your administrator.",
      code: "ACCOUNT_NOT_CONFIGURED",
    };
  }

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

  // 5. Complete the exact authenticated user's lifecycle through the
  // server-only admin boundary. Ordinary users cannot update portal_users
  // under RLS, which previously left invited buyers/traders/suppliers in a
  // redirect loop after an administrator assigned a password.
  if (portalUser.status === "invited") {
    const now = new Date().toISOString();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createAdminClient() as any;
      const { data: activated, error: lifecycleError } = await admin
        .from("portal_users")
        .update({ status: "active", last_login_at: now, updated_at: now })
        .eq("id", portalUser.id)
        .eq("auth_user_id", data.user.id)
        .eq("status", "invited")
        .select("id")
        .maybeSingle();
      if (lifecycleError || !activated) throw new Error("Account activation failed");
    } catch {
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Your account could not be activated. Please contact your administrator.",
        code: "ACCOUNT_ACTIVATION_FAILED",
      };
    }
  } else {
    // Login telemetry must never make an otherwise valid active account unavailable.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createAdminClient() as any;
      await admin.from("portal_users").update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", portalUser.id).eq("auth_user_id", data.user.id);
    } catch {
      // Audit logging below is also best-effort.
    }
  }

  // 5b. Record a login-history event (fire-and-forget; never blocks login).
  if (portalUser) {
    await logLoginEvent(portalUser.id, email);
  }

  // 6. Return redirect path
  return {
    success: true,
    data: { redirectTo: "/projects" },
  };
}
