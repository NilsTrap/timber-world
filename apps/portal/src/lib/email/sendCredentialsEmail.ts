/**
 * Send Credentials Email
 *
 * Sends login credentials to new portal users.
 * Uses Resend if RESEND_API_KEY is configured, otherwise logs to console.
 */

interface CredentialsEmailData {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate the credentials email HTML content
 */
function generateEmailHtml(data: CredentialsEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Timber World Portal Access</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1a4d2e; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Timber World Portal</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px;">Hello ${data.name},</p>

    <p style="font-size: 16px;">Your account has been created for the Timber World Production Portal.</p>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Login URL:</p>
      <p style="margin: 0 0 15px 0;"><a href="${data.loginUrl}" style="color: #1a4d2e; font-weight: 600;">${data.loginUrl}</a></p>

      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Email:</p>
      <p style="margin: 0 0 15px 0; font-weight: 600;">${data.email}</p>

      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Temporary Password:</p>
      <p style="margin: 0; font-family: monospace; font-size: 18px; font-weight: 600; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px dashed #d1d5db;">${data.temporaryPassword}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280;">Please log in and change your password after first access.</p>

    <p style="font-size: 14px; color: #6b7280;">If you have questions, contact your administrator.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 14px; color: #9ca3af; margin: 0;">Best regards,<br>Timber World Team</p>
  </div>
</body>
</html>
`;
}

/**
 * Generate plain text email content
 */
function generateEmailText(data: CredentialsEmailData): string {
  return `Hello ${data.name},

Your account has been created for the Timber World Production Portal.

Login URL: ${data.loginUrl}
Email: ${data.email}
Temporary Password: ${data.temporaryPassword}

Please log in and change your password after first access.

If you have questions, contact your administrator.

Best regards,
Timber World Team
`;
}

/**
 * Send credentials email using Resend (if configured) or console.log
 */
export async function sendCredentialsEmail(
  data: CredentialsEmailData
): Promise<EmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromSender =
    process.env.RESEND_FROM_EMAIL ||
    "Nilitto Trading Platform <noreply@mail.nilitto.com>";

  const emailHtml = generateEmailHtml(data);
  const emailText = generateEmailText(data);
  const subject = "Your Timber World Portal Access";

  // If no Resend API key, log to console for development
  if (!resendApiKey) {
    console.log("\n========================================");
    console.log("CREDENTIALS EMAIL (console mode - no RESEND_API_KEY)");
    console.log("========================================");
    console.log(`To: ${data.to}`);
    console.log(`Subject: ${subject}`);
    console.log("----------------------------------------");
    console.log(emailText);
    console.log("========================================\n");

    return {
      success: true,
      messageId: "console-" + Date.now(),
    };
  }

  // Send via Resend
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromSender,
        to: [data.to],
        subject,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      return {
        success: false,
        error: `Failed to send email: ${response.statusText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending email",
    };
  }
}
