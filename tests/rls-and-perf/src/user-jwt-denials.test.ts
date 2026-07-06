/**
 * Epic T / T7 — salesperson-KEY MCP DENIAL proofs (the per-user-key wall, over the
 * DEPLOYED endpoint).
 *
 * This is the companion to user-jwt-writes.test.ts. That file proves the raw user-JWT
 * ↔ RLS wall at the DB. This file proves the MCP ROUTE's per-user-key behaviour end to
 * end against the live endpoint: a salesperson key
 *   (a) reads a deal through the OWNER'S FIELD WALL — chain / supplier / margin fields
 *       are stripped (projectDealView), exactly like the portal Deal tab;
 *   (b) sees NO buy-leg (purchase) deals in list_deals;
 *   (c) is REFUSED every catalog write (admin capability it lacks) — FORBIDDEN;
 *   (d) may write a CRM contact / person on a CLIENT org (its clients book) but is
 *       FORBIDDEN on a SUPPLIER org (the fine per-org counterparty scope);
 *   (e) cannot read a spine — spine rows are admin-walled by RLS, so get_spine returns
 *       nothing for a non-admin key.
 *
 * The key path (apps/portal/src/app/api/timber-mcp/route.ts): a bearer that is NOT an
 * env owner token is sha256-hashed and matched in `mcp_api_keys`; the match resolves a
 * user-JWT-scoped Supabase client (RLS = the owner's walls) + a user actor whose
 * isPlatformAdmin is the owner's REAL status. Writes are additionally gated by
 * USER_WRITE_CAPABILITY resolved from the owner's access profile. It FAILS CLOSED: if
 * the server has no SUPABASE_JWT_SECRET it cannot mint the user JWT, so a validly
 * provisioned key is rejected (HTTP 401 / auth error).
 *
 * ── SKIP vs RUN ──────────────────────────────────────────────────────────────────
 * Staging does NOT yet have SUPABASE_JWT_SECRET set, so the whole user-key channel is
 * inert there. This test therefore:
 *   • SKIPS (exit 0, clear message) when the local provisioning creds are absent, when
 *     the salesperson/orgs aren't seeded, OR when a freshly-provisioned key is rejected
 *     by the endpoint (⇒ the server's SUPABASE_JWT_SECRET is unset — the current state);
 *   • RUNS the (a)–(e) denial assertions only when a provisioned key AUTHENTICATES.
 * It never blocks a commit on a secret it doesn't have, and it always cleans up the key
 * (+ any probe rows) it created.
 *
 * ── HOW TO RUN (once SUPABASE_JWT_SECRET is on the staging Vercel env) ─────────────
 * From tests/rls-and-perf, put these in .env.local (all gitignored):
 *     TEST_SUPABASE_URL              = staging Supabase URL (fyzrtqsnmnizoxgcqsjc)
 *     TEST_SUPABASE_SERVICE_ROLE_KEY = staging service-role key (to provision the key
 *                                      + resolve entities + clean up)
 *     MCP_ENDPOINT                   = https://timber-portal-staging.vercel.app/api/timber-mcp
 *                                      (optional; this is the default)
 *     SALESPERSON_EMAIL              = a portal_user in the SALESPERSON persona — clients
 *                                      book + deal_terms, NO admin, NO suppliers book
 *                                      (optional; default test-house-sales@ijl.test)
 * Ensure that persona + a CLIENT (is_customer) org, a SUPPLIER (is_supplier) org and at
 * least one sell deal the salesperson's org is party to exist (run src/lib/seed.ts), then:
 *     node_modules/.bin/tsx src/user-jwt-denials.test.ts
 * The server mints the user JWT with ITS OWN SUPABASE_JWT_SECRET; this test never needs
 * that secret locally — it only needs the endpoint to be able to mint (which the 401
 * probe detects).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── minimal .env.local load (same loader as user-jwt-writes.test.ts) ──
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
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const ENDPOINT = process.env.MCP_ENDPOINT || "https://timber-portal-staging.vercel.app/api/timber-mcp";
const SALES_EMAIL = process.env.SALESPERSON_EMAIL || "test-house-sales@ijl.test";

function skip(reason: string): never {
  console.log(`SKIP user-jwt-denials: ${reason}`);
  process.exit(0);
}
if (!URL || !SERVICE) skip("TEST_SUPABASE_URL / _SERVICE_ROLE_KEY not set (cannot provision a key)");

// sha256-hex — byte-for-byte apps/portal/src/lib/mcp/apiKeys.ts hashApiKey(). The
// route stores/looks up this digest; the plaintext is the bearer we send.
const MCP_KEY_PREFIX = "tmbr_mcp_";
function generateApiKey(): string {
  return MCP_KEY_PREFIX + randomBytes(24).toString("hex");
}
function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function admin(): SupabaseClient {
  return createClient(URL as string, SERVICE as string, { auth: { persistSession: false, autoRefreshToken: false } });
}

let passed = 0;
let failed = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`✓ ${label}`); }
  else { failed++; console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

type McpResult = { http: number; rpcError?: string; toolError?: string; payload?: any; raw: string };
/** POST a tools/call with the salesperson key. Distinguishes HTTP auth failure,
 *  JSON-RPC error, tool-level isError (FORBIDDEN…), and a success payload. */
async function mcpCall(key: string, name: string, args: unknown): Promise<McpResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now() % 100000, method: "tools/call", params: { name, arguments: args } }),
  });
  const raw = await res.text();
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* non-JSON (e.g. 401 page) */ }
  const rpcError = json?.error?.message as string | undefined;
  const isToolError = json?.result?.isError === true;
  const text = json?.result?.content?.[0]?.text as string | undefined;
  let payload: any;
  if (!isToolError && text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { http: res.status, rpcError, toolError: isToolError ? (text ?? "isError") : undefined, payload, raw };
}

/** True if a deal view leaked any chain / supplier / margin field (with a value). */
function leaksWalledDealFields(deal: any): string[] {
  if (!deal || typeof deal !== "object") return [];
  const sensitive = [
    "upstreamDealId", "upstream_deal_id",           // the buy-leg link (chain)
    "marginApprovedAt", "margin_approved_at", "margin", "marginPct", "buyPrice", "buy_price",
    "supplierOrganisationId", "supplier_organisation_id", "sourceOrganisationId", "source_organisation_id",
  ];
  return sensitive.filter((k) => k in deal && deal[k] != null);
}

async function main() {
  const a = admin();

  // ── entities (service client). Any missing ⇒ SKIP (env not provisioned, not a fail).
  const { data: sales } = await a.from("portal_users").select("id, auth_user_id, organisation_id").eq("email", SALES_EMAIL).maybeSingle();
  if (!sales || !sales.auth_user_id) skip(`salesperson persona ${SALES_EMAIL} not found / has no auth user (run src/lib/seed.ts)`);
  const { data: clientOrg } = await a.from("organisations").select("id, code").eq("is_customer", true).eq("is_active", true).limit(1).maybeSingle();
  const { data: supplierOrg } = await a.from("organisations").select("id, code").eq("is_supplier", true).eq("is_active", true).limit(1).maybeSingle();
  if (!clientOrg || !supplierOrg) skip("need at least one active is_customer AND one active is_supplier org (seed them)");
  // A sell deal the salesperson's org is party to (for the field-wall read). Optional.
  const { data: sellDeal } = await a
    .from("orders").select("id").eq("seller_organisation_id", sales.organisation_id).limit(1).maybeSingle();
  const { data: anySpine } = await a.from("spines").select("id").limit(1).maybeSingle();
  // A variant to attempt a catalog write against (write is refused BEFORE the row is
  // touched, so a placeholder id is fine even if none exists).
  const { data: anyVariant } = await a.from("catalog_variants").select("id").limit(1).maybeSingle();

  // ── provision a salesperson MCP key (idempotent-ish: unique hash per run) ──
  const plaintext = generateApiKey();
  const key_hash = hashApiKey(plaintext);
  const { data: inserted, error: insErr } = await a
    .from("mcp_api_keys")
    .insert({ portal_user_id: sales.id, key_hash, label: "t7-denials-scaffold (auto)", is_readonly: false })
    .select("id")
    .maybeSingle();
  if (insErr || !inserted) skip(`could not provision mcp_api_keys row: ${insErr?.message ?? "no id"}`);
  const keyId = inserted!.id as string;
  const cleanupKey = async () => { await a.from("mcp_api_keys").delete().eq("id", keyId); };

  try {
    // ── AUTH PROBE — the fail-closed gate. A benign read; if the endpoint rejects a
    //    validly provisioned key, the server has no SUPABASE_JWT_SECRET ⇒ SKIP. ──
    const probe = await mcpCall(plaintext, "timber_get_people_directory", {});
    const authFailed =
      probe.http === 401 ||
      /token|auth|unauthor|jwt|secret|forbidden: (unknown|revoked)/i.test(probe.rpcError ?? "") ||
      /SUPABASE_JWT_SECRET|user-key auth|cannot mint/i.test(probe.toolError ?? "");
    if (authFailed) {
      await cleanupKey();
      skip(`endpoint rejected a provisioned user key (http=${probe.http}, msg=${(probe.rpcError ?? probe.toolError ?? probe.raw).slice(0, 120)}) — staging SUPABASE_JWT_SECRET is not set; user-key channel inert. (This is the CURRENT expected state.)`);
    }
    console.log(`· salesperson key authenticated (http=${probe.http}) — running denial assertions`);

    // (a) get_deal is FIELD-WALLED — chain / supplier / margin stripped.
    if (sellDeal) {
      const r = await mcpCall(plaintext, "timber_get_deal", { deal_id: sellDeal.id });
      const deal = r.payload?.deal ?? r.payload;
      const leaks = leaksWalledDealFields(deal);
      ok("(a) get_deal hides chain/supplier/margin fields for a salesperson key", r.toolError == null && leaks.length === 0, `leaked=${leaks.join(",") || "none"} toolError=${r.toolError ?? "none"}`);
    } else {
      console.log("· (a) skipped — no sell deal for the salesperson's org");
    }

    // (b) list_deals excludes buy-leg (purchase) deals.
    {
      const r = await mcpCall(plaintext, "timber_list_deals", { limit: 200 });
      const deals: any[] = Array.isArray(r.payload) ? r.payload : (r.payload?.deals ?? []);
      const buyLegs = deals.filter((d) => d?.dealKind === "purchase_only" || d?.deal_kind === "purchase_only");
      ok("(b) list_deals excludes buy legs (no purchase_only) for a salesperson key", r.toolError == null && buyLegs.length === 0, `buyLegs=${buyLegs.length} total=${deals.length}`);
    }

    // (c) a catalog write is FORBIDDEN (admin capability the salesperson lacks).
    {
      const r = await mcpCall(plaintext, "timber_save_variant", { id: anyVariant?.id, price_eur_cents: 12345 });
      ok("(c) catalog write (save_variant) is FORBIDDEN for a salesperson key", r.toolError != null && /forbidden|permission denied/i.test(r.toolError), `toolError=${r.toolError ?? "none"} rpc=${r.rpcError ?? "none"}`);
    }

    // (d) CRM book scope — write allowed on a CLIENT org, FORBIDDEN on a SUPPLIER org.
    let createdClientContactId: string | null = null;
    {
      const onSupplier = await mcpCall(plaintext, "timber_upsert_org_contact", { org_id: supplierOrg.id, name: "t7-denial supplier probe (should be refused)" });
      // The coarse `counterparty` cap admits the salesperson (they hold the clients book);
      // the FINE per-org check (contactGate) then refuses the supplier org — its message is
      // "Permission denied", so accept either wording.
      ok("(d1) upsert_org_contact on a SUPPLIER org is FORBIDDEN for a salesperson key", onSupplier.toolError != null && /forbidden|permission denied/i.test(onSupplier.toolError), `toolError=${onSupplier.toolError ?? "none"}`);

      const onClient = await mcpCall(plaintext, "timber_upsert_org_contact", { org_id: clientOrg.id, name: "t7-denial client probe (delete me)", notes: "temporary — T7 denial scaffold" });
      const allowed = onClient.toolError == null && (onClient.payload?.id || onClient.payload?.contact?.id);
      createdClientContactId = (onClient.payload?.id || onClient.payload?.contact?.id) ?? null;
      ok("(d2) upsert_org_contact on a CLIENT org is ALLOWED for a salesperson key", Boolean(allowed), `toolError=${onClient.toolError ?? "none"}`);
    }
    // cleanup the client-side probe contact (service client — bypasses the wall).
    if (createdClientContactId) await a.from("org_contacts").delete().eq("id", createdClientContactId);

    // (e) get_spine is admin-walled (RLS) — a salesperson key reads nothing.
    if (anySpine) {
      const r = await mcpCall(plaintext, "timber_get_spine", { spine_id: anySpine.id });
      const gotSpine = r.toolError == null && r.payload && (r.payload.id || r.payload.spine?.id || r.payload.code);
      ok("(e) get_spine is admin-only (RLS-walled) — salesperson key sees no spine", !gotSpine, `payload=${JSON.stringify(r.payload)?.slice(0, 80)} toolError=${r.toolError ?? "none"}`);
    } else {
      console.log("· (e) skipped — no spine rows to probe");
    }
  } finally {
    await cleanupKey();
  }

  console.log(`\n${passed} passed, ${failed} failed — salesperson-key MCP denial probes`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`user-jwt-denials crashed: ${(e as Error).message}`);
  process.exitCode = 1;
});
