import assert from "node:assert/strict";

import { sendCredentialsEmail } from "./sendCredentialsEmail";
import { sendPasswordResetEmail } from "./sendPasswordResetEmail";

const FALLBACK_SENDER = "Nilitto Trading Platform <noreply@mail.nilitto.com>";
const CONFIGURED_SENDER = "Custom Sender <custom@mail.nilitto.com>";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;

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

    console.log("2 portal email sender assertions passed.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  }
}

void run();
