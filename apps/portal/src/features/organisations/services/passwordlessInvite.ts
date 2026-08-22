import { siteConfig } from "@timber/config";
import type { PersonOnboardingDb } from "./personOnboarding";

export type PasswordlessInviteResult =
  | { ok: true; email: string; mode: "sent" | "resent" }
  | { ok: false; code: "ONBOARDING_DENIED" | "ALREADY_ACTIVE" | "MAIL_FAILED" };

/**
 * Send or resend a Supabase passwordless invite without returning, logging, or
 * persisting a link/token. Resend never deletes/recreates the auth identity.
 */
export async function sendPasswordlessInvite(
  db: PersonOnboardingDb,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authAdmin: any,
  userId: string,
  organisationId: string,
  invitedBy: string | null = null,
): Promise<PasswordlessInviteResult> {
  const [{ data: user }, { data: membership }, { data: org }] = await Promise.all([
    db.from("portal_users").select("id, email, name, role, auth_user_id, status, is_active").eq("id", userId).maybeSingle(),
    db.from("organization_memberships").select("id").eq("user_id", userId).eq("organization_id", organisationId).eq("is_active", true).maybeSingle(),
    db.from("organisations").select("name").eq("id", organisationId).eq("is_active", true).maybeSingle(),
  ]);
  if (!user || !membership || !org || user.is_active !== true) return { ok: false, code: "ONBOARDING_DENIED" };
  if (user.status === "active") return { ok: false, code: "ALREADY_ACTIVE" };

  const redirectTo = `${siteConfig.url.replace(/\/$/, "")}/accept-invite`;
  if (!user.auth_user_id) {
    const { data, error } = await authAdmin.auth.admin.inviteUserByEmail(user.email, {
      data: { name: user.name, role: user.role, organisation_name: org.name },
      redirectTo,
    });
    if (error || !data?.user) return { ok: false, code: "MAIL_FAILED" };
    const { error: updateError } = await db.from("portal_users").update({
      auth_user_id: data.user.id,
      status: "invited",
      invited_at: new Date().toISOString(),
      invited_by: invitedBy,
      updated_at: new Date().toISOString(),
    }).eq("id", userId).is("auth_user_id", null);
    return updateError ? { ok: false, code: "MAIL_FAILED" } : { ok: true, email: user.email, mode: "sent" };
  }

  const { error } = await authAdmin.auth.resend({
    type: "invite",
    email: user.email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, code: "MAIL_FAILED" };
  await db.from("portal_users").update({
    invited_at: new Date().toISOString(),
    invited_by: invitedBy,
    updated_at: new Date().toISOString(),
  }).eq("id", userId).eq("auth_user_id", user.auth_user_id);
  return { ok: true, email: user.email, mode: "resent" };
}
