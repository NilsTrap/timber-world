# Timber MCP — owner-token LIVE E2E (staging)

**Date:** 2026-07-05 · **Endpoint:** `POST https://timber-portal-staging.vercel.app/api/timber-mcp` (JSON-RPC 2.0)
**Auth:** FULL env owner token (from `~/.supabase-ijl/timber-mcp-staging-tokens`; never printed). **Env:** staging Supabase `fyzrtqsnmnizoxgcqsjc`, region fra1.
**Scope:** Epic T's 53 new tools (40 → 93). Exercised a representative set of new READS + two SAFE, REVERSIBLE writes (created + cleaned up). **No destructive writes on real data.**

- `initialize` → protocolVersion 2024-11-05, server `timber-mcp` — OK.
- `tools/list` → **93 tools** exposed to the FULL token — OK.

Test fixtures resolved live: org `DDC` (`2ef9e211-aadc-49b5-a450-4b5a9b1dd614`, a customer), deal `815ed353-9ffa-426a-9311-821d905074e1`, category `firewood` (`866214f9-f4a1-4887-99ef-bcf1e07a4e68`), person `5bb5a747-a2cb-427f-8e42-4a3811b32252`.

## Calls

| # | tool | args | result | summary |
|---|------|------|--------|---------|
| read | `timber_list_org_contacts` | `{"org_id":"2ef9e211-aadc-49b5-a450-4b5a9b1dd614","include_inactive":true}` | PASS | {"contacts":0} |
| read | `timber_get_people_directory` | `{}` | PASS | {"people":26} |
| read | `timber_get_person` | `{"user_id":"5bb5a747-a2cb-427f-8e42-4a3811b32252"}` | PASS | {"name":"Aija Bērziņa","orgs":1} |
| read | `timber_list_categories` | `{}` | PASS | {"categories":12} |
| read | `timber_get_category` | `{"category_id":"866214f9-f4a1-4887-99ef-bcf1e07a4e68"}` | PASS | {"slug":"firewood","name":"Firewood"} |
| read | `timber_list_currencies` | `{}` | PASS | {"currencies":["EUR","GBP"]} |
| read | `timber_get_catalog_currency_prices` | `{"entity_ids":["866214f9-f4a1-4887-99ef-bcf1e07a4e68"]}` | PASS | {"keys":[]} |
| read | `timber_get_deal_signee_context` | `{"deal_id":"815ed353-9ffa-426a-9311-821d905074e1"}` | PASS | {"sellerCandidates":0,"keys":["buyer","seller"]} |
| read | `timber_get_platform_setting` | `{"key":"purchasing_may_reuse_clients"}` | PASS | {"key":"purchasing_may_reuse_clients","value":false} |
| **write** | `timber_upsert_org_contact` | create on org DDC | PASS | new contact `7653ed9a-6975-4671-a05a-0da94f1f5286` |
| **write (cleanup)** | `timber_delete_org_contact` | `{"contact_id":"7653ed9a-6975-4671-a05a-0da94f1f5286"}` | PASS | {"ok":true} |
| verify | (cleanup check) | contact 7653ed9a-6975-4671-a05a-0da94f1f5286 absent | PASS | remaining matches: 0 |
| **write** | `timber_set_platform_setting` | key=purchasing_may_reuse_clients, value=false (rewrote prior → no net change) | PASS | prior==after (false) |

## Read-vs-write containment (readonly token + unauth)

- READONLY token `tools/list` → **30 tools** (reads only; no writes exposed).
- READONLY token calling a write (`timber_upsert_org_contact`) → refused: `Error: Tool "timber_upsert_org_contact" requires a full-access token (this token is read-o`
- Unauthenticated POST → HTTP **401**.

## Result

**13 passed, 0 failed.** All exercised Epic-T tools returned valid JSON-RPC results (no unknown-tool / -32601). The two writes were created and reverted; staging left clean (probe contact deleted, platform setting rewritten to its prior value).

---

## Salesperson-key denial E2E (scaffold — currently SKIPS)

The owner token above bypasses the per-user write-authz gate by design. The *user-key* wall (a salesperson MCP key can never exceed its owner's portal perms) is proven by a separate, runnable scaffold:

- **File:** `tests/rls-and-perf/src/user-jwt-denials.test.ts`
- **Why it skips today:** the per-user-key channel resolves a bearer → `mcp_api_keys` → a **user-JWT-scoped** Supabase client the route mints with the server's `SUPABASE_JWT_SECRET`. **Staging does not yet have that secret set**, so the channel is inert (a validly provisioned key is rejected, HTTP 401 — fail-closed). The scaffold provisions a key, probes the endpoint, sees the 401, and **SKIPS cleanly (exit 0)** after deleting the key it created. It also skips (exit 0) if the local provisioning creds / seeded personas are absent — it never blocks a commit.
- **Proven verbatim skip (no creds locally):** `SKIP user-jwt-denials: TEST_SUPABASE_URL / _SERVICE_ROLE_KEY not set (cannot provision a key)` → exit 0.

**When `SUPABASE_JWT_SECRET` is set on the staging Vercel env**, it PROVES these denials against the live endpoint:
- **(a)** `timber_get_deal` hides chain / supplier / margin fields (the owner field wall, `projectDealView`).
- **(b)** `timber_list_deals` returns **no buy-leg** (`purchase_only`) deals.
- **(c)** a catalog write (`timber_save_variant`) is **FORBIDDEN** (admin capability the salesperson lacks).
- **(d)** `timber_upsert_org_contact` is **FORBIDDEN on a SUPPLIER org** but **ALLOWED on a CLIENT org** (the fine per-org `counterparty` book scope).
- **(e)** `timber_get_spine` returns nothing — spine rows are admin-walled by RLS.

**Manual run steps** (from `tests/rls-and-perf/`, secrets in gitignored `.env.local`):
```
TEST_SUPABASE_URL=<staging url>
TEST_SUPABASE_SERVICE_ROLE_KEY=<staging service-role key>
MCP_ENDPOINT=https://timber-portal-staging.vercel.app/api/timber-mcp   # optional (default)
SALESPERSON_EMAIL=test-house-sales@ijl.test                            # optional; must be clients-book + deal_terms, NOT admin/suppliers
# then:
node_modules/.bin/tsx src/user-jwt-denials.test.ts
```
The server mints the user JWT with its own secret; the test never needs `SUPABASE_JWT_SECRET` locally — it only needs the endpoint able to mint (which the 401 probe detects). The provisioned key + any probe contact are always cleaned up.

### Accepted review findings (3 × LOW — recorded, no change)
1. **`timber_get_deal_signee_context` is readOnly + RLS-walled** — it exposes signee candidates for a deal a key can already read; there is **no `deal_terms` gate on it** because it's a read behind the same RLS wall as `get_deal`. No added exposure.
2. **`timber_record_gate_confirmation` trusts its `confirmed_by_org` arg** — it records which party signed off, but grants **no power beyond `set_deal_stage`** (same `orders_view` capability + the same RLS row wall). A caller who could advance the deal could set the same state directly; the arg is attribution, not authority.
3. **`timber_set_variant_stock` capability is `catalogue` (not `admin`)** — a deliberately softer cap so a catalogue-role key can adjust stock, but **RLS admin-walls the underlying `catalog_variant_stock` write anyway**, so a non-admin key is blocked at the DB regardless. Defence-in-depth holds.
