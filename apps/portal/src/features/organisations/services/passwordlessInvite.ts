import { sendNilittoInviteEmail } from "@/lib/email/sendNilittoInviteEmail";
import type { PersonOnboardingDb } from "./personOnboarding";

export type PasswordlessInviteResult =
  | { ok: true; email: string; mode: "sent" | "resent" }
  | { ok: false; code: "ONBOARDING_DENIED" | "ALREADY_ACTIVE" | "MAIL_FAILED" };

const STAGING_PORTAL_URL = "https://staging.nilitto.com";

export function resolveInviteAppUrl(
  configuredUrl = process.env.NEXT_PUBLIC_APP_URL,
  nodeEnv = process.env.NODE_ENV,
): string {
  const fallback = nodeEnv === "production" ? STAGING_PORTAL_URL : "http://localhost:3000";

  try {
    const url = new URL(configuredUrl || fallback);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";

    // A stale Vercel environment variable must never put an unreachable local
    // address in an email sent from a deployed portal.
    if (nodeEnv === "production" && (url.protocol !== "https:" || isLocal)) return STAGING_PORTAL_URL;
    return url.origin;
  } catch {
    return fallback;
  }
}

/**
 * Generate a one-time Supabase activation link and deliver the application-
 * controlled Nilitto email through Resend. The link/token is never returned,
 * logged or persisted.
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

  const isResend = Boolean(user.auth_user_id);
  const appUrl = resolveInviteAppUrl();
  const redirectTo = `${appUrl}/accept-invite`;
  const linkType = user.auth_user_id ? "recovery" : "invite";
  const { data, error } = await authAdmin.auth.admin.generateLink({
    type: linkType,
    email: user.email,
    options: {
      data: { name: user.name, role: user.role, organisation_name: org.name },
      redirectTo,
    },
  });
  const actionLink = data?.properties?.action_link;
  const authUserId = data?.user?.id ?? user.auth_user_id;
  if (error || !actionLink || !authUserId) return { ok: false, code: "MAIL_FAILED" };

  const now = new Date().toISOString();
  if (!user.auth_user_id) {
    const { error: updateError } = await db.from("portal_users").update({
      auth_user_id: authUserId,
      status: "invited",
      invited_at: now,
      invited_by: invitedBy,
      updated_at: now,
    }).eq("id", userId).is("auth_user_id", null);
    if (updateError) return { ok: false, code: "MAIL_FAILED" };
  }

  const mail = await sendNilittoInviteEmail({
    to: user.email,
    name: user.name,
    organisationName: org.name,
    inviteUrl: actionLink,
  });
  if (!mail.success) return { ok: false, code: "MAIL_FAILED" };

  await db.from("portal_users").update({
    status: "invited",
    invited_at: now,
    invited_by: invitedBy,
    updated_at: now,
  }).eq("id", userId).eq("auth_user_id", authUserId);
  return { ok: true, email: user.email, mode: isResend ? "resent" : "sent" };
}
