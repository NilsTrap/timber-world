"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Q4 · Admin manual set-password.
 *
 * Directly sets a portal user's login password (no email round-trip) via the
 * Supabase Auth admin API. For the admin who wants to hand a user a password
 * rather than send an invite/reset link.
 *
 * GUARD: isAdmin || isSuperAdmin ONLY — never exposed to a scoped caller.
 *
 * SECURITY — the password is NEVER logged: not to console, not in the returned
 * error, not in any activity record. Errors surface only Supabase's generic
 * message. If the user has no auth_user_id yet (never invited), we refuse and
 * point at "Send credentials" — you can't set a password on an account that
 * doesn't exist in auth yet.
 */

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or less"); // bcrypt hard limit

export async function setUserPasswordAdmin(
  portalUserId: string,
  newPassword: string,
): Promise<ActionResult<{ email: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };

  // Admin-only (either legacy admin role or platform admin) — no scoped path.
  if (!isAdmin(session) && !isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(portalUserId)) {
    return { success: false, error: "Invalid user ID", code: "INVALID_ID" };
  }

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    // parsed.error carries only the validation message, never the password value.
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid password", code: "WEAK_PASSWORD" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: portalUser, error: userError } = await admin
    .from("portal_users")
    .select("id, email, auth_user_id")
    .eq("id", portalUserId)
    .maybeSingle();

  if (userError || !portalUser) {
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }

  if (!portalUser.auth_user_id) {
    return {
      success: false,
      error: "This user has no login yet. Use “Send credentials” first, then you can set a password.",
      code: "NO_AUTH_USER",
    };
  }

  // Set the password directly. Only the validated `newPassword` is passed to the
  // auth API; it is never written to logs or the returned payload.
  const { error: updateError } = await createAdminClient().auth.admin.updateUserById(
    portalUser.auth_user_id as string,
    { password: parsed.data },
  );

  if (updateError) {
    // Log a redacted message only — never the password.
    console.error("Failed to set user password:", updateError.message);
    return { success: false, error: updateError.message || "Failed to set password", code: "SET_PASSWORD_FAILED" };
  }

  return { success: true, data: { email: portalUser.email as string } };
}
