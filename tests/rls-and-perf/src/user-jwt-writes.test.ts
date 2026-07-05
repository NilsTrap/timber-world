/**
 * Epic T / T2 — user-JWT WRITE proofs (audit RISK 3: the under-tested area).
 *
 * The MCP per-user-key path (apps/portal/src/app/api/timber-mcp/route.ts) resolves
 * a key to a user-JWT-scoped Supabase client: a JWT MINTED with SUPABASE_JWT_SECRET
 * (sub = portal_users.auth_user_id), handed to an anon client so PostgREST runs
 * every query as that user and RLS applies their walls. The read side is covered by
 * the snapshot/negative suites; the WRITE side (INSERT into orders / spines) is the
 * gap this file closes — it exercises the EXACT minting path the route uses and
 * asserts RLS behaves for a user-JWT write.
 *
 * SKIP vs RUN
 *   Minting a user JWT requires SUPABASE_JWT_SECRET (the project's GoTrue secret).
 *   It is not yet provisioned on staging, so this test SKIPS (exit 0) with a clear
 *   message when the secret (or the staging creds, or the seeded users) are absent,
 *   and RUNS the real assertions when they are all present. It never blocks a commit
 *   on a secret it doesn't have.
 *
 * HOW TO RUN (once SUPABASE_JWT_SECRET is on staging)
 *   From tests/rls-and-perf, put these in .env.local (all gitignored):
 *     TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY,
 *     SUPABASE_JWT_SECRET
 *   Ensure the seed has run (src/lib/seed.ts creates the @ijl.test users), then:
 *     node_modules/.bin/tsx src/user-jwt-writes.test.ts
 *   (SUPABASE_JWT_SECRET is the staging project's JWT secret — Supabase dashboard →
 *   Project settings → API → JWT Settings; NEVER commit it.)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── minimal env load (mirror config.ts's .env.local loader; do NOT import config.ts
//    — its top-level `required()` throws when TEST_* is absent, defeating the skip). ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = join(__dirname, "..", ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

function skip(reason: string): never {
  console.log(`SKIP user-jwt-writes: ${reason}`);
  process.exit(0);
}

if (!URL || !ANON || !SERVICE) skip("TEST_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY not set");
if (!JWT_SECRET) skip("SUPABASE_JWT_SECRET not set (user-JWT minting unavailable — see file header)");

// ── HS256 JWT mint — byte-for-byte the claims mintUserAccessToken() emits, but with
//    node:crypto so the harness needs no extra dependency (jose). ──
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function mintUserAccessToken(authUserId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ role: "authenticated", sub: authUserId, aud: "authenticated", iat: now, exp: now + 300 }),
  );
  const sig = b64url(createHmac("sha256", JWT_SECRET as string).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function admin(): SupabaseClient {
  return createClient(URL as string, SERVICE as string, { auth: { persistSession: false, autoRefreshToken: false } });
}
/** An anon client whose every request carries the minted user JWT — the SAME
 *  construction createUserScopedClient() uses in the MCP route. */
function userJwtClient(token: string): SupabaseClient {
  return createClient(URL as string, ANON as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

let passed = 0;
let failed = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`✓ ${label}`); }
  else { failed++; console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

const PROBE_TAG = `t2-user-jwt-probe-${Date.now()}`;

async function resolveAuthUser(a: SupabaseClient, email: string): Promise<{ portalUserId: string; authUserId: string } | null> {
  const { data } = await a.from("portal_users").select("id, auth_user_id").eq("email", email).maybeSingle();
  if (!data || !data.auth_user_id) return null;
  return { portalUserId: data.id as string, authUserId: data.auth_user_id as string };
}

async function resolveOrgId(a: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await a.from("organisations").select("id").eq("code", code).maybeSingle();
  return (data?.id as string | null) ?? null;
}

/** Delete any orders/spines a probe leaked, via the admin client. */
async function cleanup(a: SupabaseClient): Promise<void> {
  await a.from("orders").delete().eq("notes", PROBE_TAG);
  await a.from("spines").delete().ilike("title", `${PROBE_TAG}%`);
}

async function main() {
  const a = admin();

  // Entities. The seed (src/lib/seed.ts) creates these; absent → skip (not a failure).
  const limited = await resolveAuthUser(a, "test-org-a-limited@ijl.test"); // org-a, orders.view only, NO deal-side right
  const sales = await resolveAuthUser(a, "test-house-sales@ijl.test");     // org-a, salesperson group → side.sell + deal_terms
  const orgA = await resolveOrgId(a, "JLA");
  if (!limited || !orgA) skip("seeded users/orgs not found — run `pnpm exec tsx src/lib/seed.ts` first");

  await cleanup(a); // clear any residue from a prior run

  // ── Probe 1 (NEGATIVE) · a visibility-only user (org member, NO side.sell/side.buy
  //    right) must NOT be able to INSERT an order via their user JWT. RLS
  //    (can_access_deal_row) walls the WRITE — proving the user JWT is really scoped.
  {
    const token = mintUserAccessToken(limited!.authUserId);
    const c = userJwtClient(token);
    const { data, error } = await c
      .from("orders")
      .insert({ name: "T2 probe", seller_organisation_id: orgA, buyer_organisation_id: orgA, currency: "EUR", status: "draft", notes: PROBE_TAG })
      .select("id");
    // Verify with the ADMIN client that nothing landed — the authoritative no-leak check.
    const { data: leaked } = await a.from("orders").select("id").eq("notes", PROBE_TAG);
    const rows = (leaked ?? []).length;
    ok("orders INSERT is BLOCKED for a visibility-only user JWT (RLS)", rows === 0, `error=${error?.message ?? "none"}, inserted=${(data ?? []).length}, leaked=${rows}`);
    if (rows > 0) await cleanup(a);
  }

  // ── Probe 2 (NEGATIVE) · the same user must NOT be able to INSERT a spine via
  //    their user JWT — the spines INSERT policy requires the action/deal/create
  //    right (which the limited user lacks). Under-tested write path.
  {
    const token = mintUserAccessToken(limited!.authUserId);
    const c = userJwtClient(token);
    const { error } = await c
      .from("spines")
      .insert({ title: `${PROBE_TAG}-spine`, created_by: limited!.portalUserId })
      .select("id");
    const { data: leaked } = await a.from("spines").select("id").ilike("title", `${PROBE_TAG}%`);
    const rows = (leaked ?? []).length;
    ok("spines INSERT is BLOCKED for a user JWT without deal/create (RLS)", rows === 0, `error=${error?.message ?? "none"}, leaked=${rows}`);
    if (rows > 0) await cleanup(a);
  }

  // ── Probe 3 (POSITIVE) · an AUTHORIZED user JWT (salesperson: org-a member with
  //    the side.sell right) CAN INSERT an order whose seller is their own org —
  //    proving the user-JWT write path works end-to-end, not just that it always
  //    denies. Skipped (not failed) if the salesperson persona wasn't seeded.
  if (sales) {
    const token = mintUserAccessToken(sales.authUserId);
    const c = userJwtClient(token);
    const { data, error } = await c
      .from("orders")
      .insert({ name: "T2 probe (authorized)", seller_organisation_id: orgA, buyer_organisation_id: orgA, currency: "EUR", status: "draft", notes: PROBE_TAG })
      .select("id");
    const created = (data ?? []).length === 1 && !error;
    ok("orders INSERT is ALLOWED for an authorized (side.sell) user JWT", created, `error=${error?.message ?? "none"}`);
    await cleanup(a); // remove the probe row regardless
  } else {
    console.log("· probe 3 (authorized-write) skipped — salesperson persona not seeded");
  }

  await cleanup(a);
  console.log(`\n${passed} passed, ${failed} failed — user-JWT write RLS probes`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`user-jwt-writes crashed: ${(e as Error).message}`);
  process.exitCode = 1;
});
