"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendNilittoRecoveryEmail } from "@/lib/email/sendNilittoRecoveryEmail";
import { resolveInviteAppUrl } from "@/features/organisations/services/passwordlessInvite";
import type { ActionResult } from "@/features/organisations/types";

const recoveryRequestSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const NEUTRAL_MESSAGE = "If an account exists for that email, a password reset link has been sent.";

export async function requestPasswordRecovery(input: unknown): Promise<ActionResult<{ message: string }>> {
  const parsed = recoveryRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Enter a valid email address", code: "INVALID_EMAIL" };

  try {
    const admin = createAdminClient();
    const redirectTo = `${resolveInviteAppUrl()}/reset-password`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: { redirectTo },
    });
    const actionLink = data?.properties?.action_link;
    if (error || !actionLink) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 400 || status === 404 || status === 422) {
        return { success: true, data: { message: NEUTRAL_MESSAGE } };
      }
      return { success: false, error: "We could not send the recovery email. Please try again later.", code: "MAIL_FAILED" };
    }

    const mail = await sendNilittoRecoveryEmail(parsed.data.email, actionLink);
    if (!mail.success) return { success: false, error: "We could not send the recovery email. Please try again later.", code: "MAIL_FAILED" };
    return { success: true, data: { message: NEUTRAL_MESSAGE } };
  } catch {
    return { success: false, error: "We could not send the recovery email. Please try again later.", code: "MAIL_FAILED" };
  }
}

export async function updateRecoveredPassword(password: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid password", code: "INVALID_PASSWORD" };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { success: false, error: "This recovery link has expired or is invalid.", code: "NO_SESSION" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { success: false, error: "Your password could not be updated. Please request a new recovery link.", code: "PASSWORD_UPDATE_FAILED" };
  return { success: true, data: { redirectTo: "/projects" } };
}

export { NEUTRAL_MESSAGE, passwordSchema, recoveryRequestSchema };
