const NILITTO_INVITE_SENDER = "Nilitto Trading Platform <noreply@mail.nilitto.com>";

export interface NilittoInviteEmailData {
  to: string;
  name: string;
  organisationName: string;
  inviteUrl: string;
}

export interface NilittoInviteEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] ?? char);
}

export async function sendNilittoInviteEmail(
  data: NilittoInviteEmailData,
): Promise<NilittoInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: "EMAIL_NOT_CONFIGURED" };

  const name = escapeHtml(data.name);
  const organisationName = escapeHtml(data.organisationName);
  const inviteUrl = escapeHtml(data.inviteUrl);
  const subject = `You are invited to ${organisationName} on Nilitto`;
  const text = `Hello ${data.name},\n\nYou have been invited to access ${data.organisationName} on the Nilitto Trading Platform.\n\nSet your password and activate your account:\n${data.inviteUrl}\n\nThis link is personal to you. If you were not expecting this invitation, you can ignore this email.\n\nNilitto Trading Platform`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2933">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
  <div style="background:#123f32;color:#fff;padding:22px 28px;border-radius:12px 12px 0 0"><strong style="font-size:22px">Nilitto</strong><div style="font-size:13px;opacity:.8">Trading Platform</div></div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:30px 28px;border-radius:0 0 12px 12px">
    <p>Hello ${name},</p>
    <p>You have been invited to access <strong>${organisationName}</strong> on the Nilitto Trading Platform.</p>
    <p style="margin:28px 0"><a href="${inviteUrl}" style="display:inline-block;background:#123f32;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Set password and activate account</a></p>
    <p style="font-size:13px;color:#667085">This link is personal to you. If you were not expecting this invitation, you can ignore this email.</p>
  </div>
</div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: NILITTO_INVITE_SENDER,
        to: [data.to],
        subject,
        html,
        text,
      }),
    });
    if (!response.ok) return { success: false, error: `RESEND_${response.status}` };
    const result = await response.json() as { id?: string };
    return { success: true, messageId: result.id };
  } catch {
    return { success: false, error: "MAIL_FAILED" };
  }
}

export { NILITTO_INVITE_SENDER };
