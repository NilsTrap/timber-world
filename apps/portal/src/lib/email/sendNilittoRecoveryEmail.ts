import { mailpitSendUrl, NILITTO_INVITE_SENDER } from "./sendNilittoInviteEmail";

const SENDER_EMAIL = "noreply@mail.nilitto.com";

export type RecoveryEmailResult =
  | { success: true; messageId?: string }
  | { success: false; error: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function sendNilittoRecoveryEmail(to: string, recoveryUrl: string): Promise<RecoveryEmailResult> {
  const safeUrl = escapeHtml(recoveryUrl);
  const subject = "Reset your Nilitto password";
  const text = `We received a request to reset your Nilitto password.\n\nChoose a new password:\n${recoveryUrl}\n\nIf you did not request this, you can ignore this email. This link is personal and expires.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2933"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#123f32;color:#fff;padding:22px 28px;border-radius:12px 12px 0 0"><strong style="font-size:22px">Nilitto</strong><div style="font-size:13px;opacity:.8">Trading Platform</div></div><div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:30px 28px;border-radius:0 0 12px 12px"><p>We received a request to reset your Nilitto password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#123f32;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Choose a new password</a></p><p style="font-size:13px;color:#667085">If you did not request this, you can ignore this email. This link is personal and expires.</p></div></div></body></html>`;
  const mailpitUrl = mailpitSendUrl();
  const apiKey = process.env.RESEND_API_KEY;
  if (!mailpitUrl && !apiKey) return { success: false, error: "EMAIL_NOT_CONFIGURED" };

  try {
    const response = await fetch(mailpitUrl ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: mailpitUrl
        ? { "Content-Type": "application/json" }
        : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(mailpitUrl
        ? { From: { Name: "Nilitto Trading Platform", Email: SENDER_EMAIL }, To: [{ Email: to }], Subject: subject, HTML: html, Text: text }
        : { from: NILITTO_INVITE_SENDER, to: [to], subject, html, text }),
    });
    if (!response.ok) return { success: false, error: `${mailpitUrl ? "MAILPIT" : "RESEND"}_${response.status}` };
    const result = await response.json() as { id?: string };
    return { success: true, messageId: result.id };
  } catch {
    return { success: false, error: "MAIL_FAILED" };
  }
}
