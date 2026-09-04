export type MailpitMessage = {
  ID: string;
  Subject: string;
  To: Array<{ Address: string; Name?: string }>;
};

type MailpitSearchResponse = { messages?: MailpitMessage[] };

function resolveMailpitUrl(configuredUrl = process.env.NILITTO_TEST_MAILPIT_URL): string {
  if (!configuredUrl) throw new Error("NILITTO_TEST_MAILPIT_URL is required for agent UI-flow tests");
  const url = new URL(configuredUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Mailpit URL must use HTTP or HTTPS");
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

async function searchMailpit(baseUrl: string, query: string): Promise<MailpitMessage[]> {
  const response = await fetch(`${baseUrl}/api/v1/search?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Mailpit search failed: ${response.status}`);
  const payload = await response.json() as MailpitSearchResponse;
  return payload.messages ?? [];
}

export async function waitForMailpitMessage(options: {
  query: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  mailpitUrl?: string;
}): Promise<MailpitMessage> {
  const baseUrl = resolveMailpitUrl(options.mailpitUrl);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await searchMailpit(baseUrl, options.query);
    const message = messages[0];
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for Mailpit message matching ${options.query}`);
}

/** Delete only the distinct messages found by this test's query. */
export async function clearMailpitMessages(options: {
  query: string;
  mailpitUrl?: string;
}): Promise<void> {
  const baseUrl = resolveMailpitUrl(options.mailpitUrl);
  const ids = [...new Set((await searchMailpit(baseUrl, options.query)).map((message) => message.ID))];
  if (ids.length === 0) return;

  const response = await fetch(`${baseUrl}/api/v1/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: ids }),
  });
  if (!response.ok) throw new Error(`Mailpit cleanup failed: ${response.status}`);
}
