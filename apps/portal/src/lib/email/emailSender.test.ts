import assert from "node:assert/strict";

import { sendCredentialsEmail } from "./sendCredentialsEmail";
import { sendPasswordResetEmail } from "./sendPasswordResetEmail";
import { sendNilittoInviteEmail } from "./sendNilittoInviteEmail";
import { sendNilittoRecoveryEmail } from "./sendNilittoRecoveryEmail";

const FALLBACK_SENDER = "Nilitto Trading Platform <noreply@mail.nilitto.com>";
const CONFIGURED_SENDER = "Custom Sender <custom@mail.nilitto.com>";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;
const originalMailpitUrl = process.env.NILITTO_TEST_MAILPIT_URL;

const sentBodies: Array<Record<string, unknown>> = [];

globalThis.fetch = async (_input, init) => {
  sentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
  return new Response(JSON.stringify({ id: `message-${sentBodies.length}` }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

async function run() {
  process.env.RESEND_API_KEY = "test-only-key";

  try {
    delete process.env.RESEND_FROM_EMAIL;
    await sendCredentialsEmail({
    to: "recipient@example.com",
    name: "Recipient",
    email: "recipient@example.com",
    temporaryPassword: "temporary-password",
    loginUrl: "https://staging.nilitto.com/login",
    });
    assert.equal(sentBodies.at(-1)?.from, FALLBACK_SENDER);

    process.env.RESEND_FROM_EMAIL = CONFIGURED_SENDER;
    await sendPasswordResetEmail({
    to: "recipient@example.com",
    name: "Recipient",
    email: "recipient@example.com",
    newPassword: "new-password",
    loginUrl: "https://staging.nilitto.com/login",
    });
    assert.equal(sentBodies.at(-1)?.from, CONFIGURED_SENDER);
    assert.equal(sentBodies.some((body) => String(body.from).includes("<Custom Sender <")), false);

    await sendNilittoInviteEmail({
      to: "recipient@example.com",
      name: "Recipient",
      organisationName: "Customer A",
      inviteUrl: "https://staging.nilitto.com/accept-invite?code=test-only",
    });
    const invite = sentBodies.at(-1);
    assert.equal(invite?.from, FALLBACK_SENDER);
    assert.match(String(invite?.subject), /Nilitto/);
    assert.doesNotMatch(String(invite?.html), /Timber World|Timber International/);

    process.env.NILITTO_TEST_MAILPIT_URL = "http://127.0.0.1:8025";
    delete process.env.RESEND_API_KEY;
    await sendNilittoInviteEmail({
      to: "supplier@example.test",
      name: "Supplier",
      organisationName: "Test supplier",
      inviteUrl: "http://localhost:3001/accept-invite?code=test-only",
    });
    const mailpitInvite = sentBodies.at(-1);
    assert.deepEqual(mailpitInvite?.From, { Name: "Nilitto Trading Platform", Email: "noreply@mail.nilitto.com" });
    assert.deepEqual(mailpitInvite?.To, [{ Email: "supplier@example.test" }]);
    assert.match(String(mailpitInvite?.Subject), /Nilitto/);
    assert.match(String(mailpitInvite?.Text), /activate your account/i);

    await sendNilittoRecoveryEmail(
      "buyer@example.test",
      "http://localhost:3001/reset-password?code=test-only",
    );
    const recovery = sentBodies.at(-1);
    assert.deepEqual(recovery?.To, [{ Email: "buyer@example.test" }]);
    assert.match(String(recovery?.Subject), /reset your nilitto password/i);
    assert.match(String(recovery?.Text), /choose a new password/i);
    assert.doesNotMatch(String(recovery?.Text), /temporary password/i);

    console.log("13 portal email sender assertions passed.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
    if (originalMailpitUrl === undefined) delete process.env.NILITTO_TEST_MAILPIT_URL;
    else process.env.NILITTO_TEST_MAILPIT_URL = originalMailpitUrl;
  }
}

void run();
