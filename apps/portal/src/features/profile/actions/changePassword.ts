"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Change User Password
 *
 * Allows authenticated users to change their own password.
 * Requires current password verification before updating.
 */
export async function changePassword(
  input: ChangePasswordInput
): Promise<ActionResult<{ message: string }>> {
  // 1. Validate input with Zod
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  const { currentPassword, newPassword } = parsed.data;
  const supabase = await createClient();

  // 2. Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 3. Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return {
      success: false,
      error: "Current password is incorrect",
      code: "INVALID_PASSWORD",
    };
  }

  // 4. Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("Failed to update password:", updateError);
    return {
      success: false,
      error: "Failed to update password. Please try again.",
      code: "UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: { message: "Password changed successfully" },
  };
}
