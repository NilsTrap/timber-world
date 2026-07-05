/**
 * Timber MCP endpoint — JSON-RPC 2.0 over HTTP for Oscar Workflows.
 *
 * Implements the Oscar "Workflows v1 for MCP builders" contract (§3/§4):
 *  - initialize / notifications/initialized / tools/list / tools/call
 *  - tools return { content: [{type:"text", text: <JSON string>}], isError }
 *  - read tools named *_list / *_get; mutations are never auto-retried (Oscar
 *    can't know they're safe), so every tool is idempotent or one-attempt-safe.
 *
 * Auth — two credential families (T1):
 *
 *  1. ENV OWNER TOKENS (trusted owner-agent / Vilma channel — UNCHANGED):
 *       TIMBER_MCP_TOKEN_FULL      → full access (workflow engine)
 *       TIMBER_MCP_TOKEN_READONLY  → read-only (chat agents; prompt-injection blast
 *                                    radius containment)
 *     These resolve to the RLS-BYPASSING admin client + the SERVICE_ACTOR service
 *     identity, and the readonly/full split gates mutations. Byte-for-byte the
 *     prior behaviour.
 *
 *  2. PER-USER API KEYS (T1 — mcp_api_keys): a bearer that is NOT an env token is
 *     hashed (sha256) and looked up in mcp_api_keys. A match resolves to a
 *     user-JWT-scoped client (RLS applies the user's OWN portal walls) + a user
 *     actor whose isPlatformAdmin reflects the user's REAL status. A per-user key
 *     can therefore NEVER exceed its owner's portal permissions. FAIL CLOSED: a
 *     missing SUPABASE_JWT_SECRET, an unknown/revoked key, or a user without an
 *     auth identity → 401, never an admin fallback.
 *
 *     T2 closes the authz gaps a review found in T1:
 *      - WRITE authz (HIGH-1): the user JWT's RLS walls WHICH rows a key may touch,
 *        but app-level authz (WHICH fields/actions a user may edit, e.g. deal_terms)
 *        lives in the portal ACTION layer and is skipped when MCP dispatches to
 *        services directly. callTool re-applies the SAME capability the twin portal
 *        action checks (USER_WRITE_CAPABILITY → authorizeUserWrite) BEFORE dispatch,
 *        for a per-user key only. DENY-by-default: a write tool with no declared
 *        capability is refused over a user key.
 *      - READ projection: deal reads (get/list) run through the key owner's field
 *        wall (projectDealView), exactly like the portal Deal tab, so a salesperson
 *        key never sees chain / supplier / margin fields.
 *      - READ-ONLY keys (MEDIUM-3): mcp_api_keys.is_readonly → role="readonly", so
 *        the readonly filter blocks every write regardless of the owner's perms.
 *
 * SECURITY — actor.isServiceAgent: the user actor carries isServiceAgent:true only
 * to tag audit rows actor_type='service' and to keep the document issuer null on
 * the MCP channel. It MUST NOT be read anywhere as an authz bypass — the row-level
 * data walls come from the user-JWT `db`, not from trusting the actor. (T2/LOW-5 split
 * the last latent bypass: upsertGateConfig in services/lifecycle.ts now requires a
 * REAL isPlatformAdmin, never isServiceAgent.)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActorContext } from "@/features/orders/services/dealModel";
import { logAudit } from "@/features/audit/logAudit";
import { hashApiKey } from "@/lib/mcp/apiKeys";
import { resolveMcpUserActor } from "@/lib/mcp/resolveMcpUserActor";
import { getAccessProfile } from "@/lib/access";
import type { AccessProfile } from "@/lib/access/types";
import { resolveFieldAccess } from "@/features/orders/services/dealFields";
import { TOOLS, USER_WRITE_CAPABILITY, type UserWriteCapability } from "./tools";
import type { AuthCtx, Role, UserCtx, ToolHandler } from "./types";
import { toolErr, UUID_RE } from "./types";
import { dealHandlers } from "./domains/deals";
import { crmHandlers } from "./domains/crm";
import { catalogHandlers } from "./domains/catalog";

export const dynamic = "force-dynamic";

const SERVICE_ACTOR: ActorContext = {
  portalUserId: null,
  isPlatformAdmin: true,
  isServiceAgent: true,
  label: "oscar-agent",
};

// Role, AuthCtx, UserCtx, UUID_RE, ToolResult, toolOk/toolErr now live in ./types
// (shared with the per-domain tool modules). The tool catalog lives in ./tools and
// the dispatch handlers in ./domains/*. This file keeps the auth core + the
// aggregated dispatch wiring only.

// ── Auth ─────────────────────────────────────────────────────────────────────
function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = (m[1] ?? "").trim();
  return token || null;
}

/** Env OWNER-token path (UNCHANGED trust model): admin client + SERVICE_ACTOR +
 *  the full/readonly split. Synchronous, no DB, no body — preserves the prior
 *  env-token behaviour exactly. */
function resolveEnvAuth(token: string): AuthCtx | null {
  const full = process.env.TIMBER_MCP_TOKEN_FULL;
  const readonly = process.env.TIMBER_MCP_TOKEN_READONLY;
  if (full && token === full) return { kind: "env", role: "full", db: createAdminClient(), actor: SERVICE_ACTOR, orgId: null };
  if (readonly && token === readonly) return { kind: "env", role: "readonly", db: createAdminClient(), actor: SERVICE_ACTOR, orgId: null };
  return null;
}

/** Per-user API-key path. Hash the bearer, look up a non-revoked key via the
 *  admin client (used ONLY for lookup + identity — never handed to a tool), then
 *  resolve the atomic (db, actor) pair. Returns null → 401 (fail closed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveUserKeyAuth(token: string, body: any): Promise<AuthCtx | null> {
  const admin = createAdminClient();
  const keyHash = hashApiKey(token);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: key } = await (admin as any)
    .from("mcp_api_keys")
    .select("id, portal_user_id, label, organisation_id, revoked_at, is_readonly")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!key || key.revoked_at) return null; // unknown or revoked ⇒ unauthorized

  // Org context: key's pin ▸ per-call org_id arg ▸ the user's primary membership.
  // NOTE: row-level data access is governed by the user JWT's RLS regardless of
  // this value — org here is audit/module context, so an out-of-scope org_id arg
  // can't over-read (RLS still walls the rows).
  const argOrgId = body?.method === "tools/call" ? body?.params?.arguments?.org_id : null;
  const orgId = await resolveKeyOrg(admin, key, argOrgId);

  // Atomic (db, actor). Throws (→ 401 in POST) if the JWT secret is missing.
  const resolved = await resolveMcpUserActor(admin, key.portal_user_id as string, orgId, (key.label as string | null) ?? null);
  if (!resolved) return null;

  // Touch last_used_at — fire-and-forget, never blocks/fails the request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (admin as any).from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  // T2 · MEDIUM-3: a read-only key resolves to role="readonly" so the existing
  // readonly filter (callTool + tools/list) blocks EVERY write tool — regardless
  // of the owner's portal permissions. A full key stays role="full" and is then
  // additionally bounded by the per-user write-authz gate + the user JWT's RLS.
  const role: Role = key.is_readonly === true ? "readonly" : "full";
  return { kind: "user", role, db: resolved.db, actor: resolved.actor, orgId: resolved.orgId, keyId: key.id as string };
}

/** pin ▸ per-call org_id arg (only if the owner is an active member) ▸ primary
 *  active membership ▸ legacy home org. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveKeyOrg(admin: any, key: any, argOrgId: unknown): Promise<string | null> {
  if (key.organisation_id) return key.organisation_id as string; // the key's pin always wins
  // Load the owner's ACTIVE memberships once — used both to validate a per-call
  // org_id and to pick the primary fallback.
  const { data: mems } = await admin
    .from("organization_memberships")
    .select("organization_id, is_primary")
    .eq("user_id", key.portal_user_id)
    .eq("is_active", true);
  const rows = (mems ?? []) as Array<{ organization_id: string; is_primary: boolean }>;
  // T2 · LOW-4: accept a per-call org_id ONLY when the owner is an ACTIVE member of
  // it. A forged/foreign org_id is IGNORED (falls through to the primary), so it can
  // never set a bogus audit-org attribution. Row-level access is walled by the user
  // JWT's RLS regardless, so this can't over-read — it protects audit context only.
  if (typeof argOrgId === "string" && UUID_RE.test(argOrgId) && rows.some((r) => r.organization_id === argOrgId)) {
    return argOrgId;
  }
  const primary = rows.find((r) => r.is_primary)?.organization_id ?? rows[0]?.organization_id ?? null;
  if (primary) return primary;
  const { data: pu } = await admin.from("portal_users").select("organisation_id").eq("id", key.portal_user_id).maybeSingle();
  return (pu?.organisation_id as string | null) ?? null;
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcResult(id: any, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcError(id: any, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}
// ── T2 · per-user write authorization + read field-wall projection ────────────

/**
 * T2 · HIGH-1 · Authorize a WRITE tool for a PER-USER key. Returns null when
 * allowed, or a FORBIDDEN message when refused. A REAL platform-admin owner
 * (actor.isPlatformAdmin reflects the user's TRUE status) passes every write, like
 * the portal admin bypass. Otherwise the tool's declared capability
 * (USER_WRITE_CAPABILITY) is resolved from the owner's access profile in the key's
 * org — the SAME check the twin portal action applies. A write tool with NO declared
 * capability is DENIED (deny-by-default).
 */
async function authorizeUserWrite(name: string, ctx: UserCtx): Promise<string | null> {
  if (ctx.actor.isPlatformAdmin) return null; // real-admin owner ⇒ portal-admin bypass
  const capability: UserWriteCapability | undefined = USER_WRITE_CAPABILITY[name];
  if (!capability) {
    // Deny-by-default: a write tool must positively declare its user-key capability.
    return `Tool "${name}" is not authorized over a per-user key.`;
  }
  const profile = await getAccessProfile(ctx.actor.portalUserId, ctx.orgId);
  if (userHasCapability(profile, capability)) return null;
  return userWriteDenialMessage(capability);
}

/** Pure capability check against a resolved profile — mirrors the portal gates
 *  (requireLineWriteAccess / resolveDealActor's orders.view / hasSuppliersBookAccess
 *  / the catalogue module gate). A real-admin owner is handled by the caller. */
function userHasCapability(profile: AccessProfile, capability: UserWriteCapability): boolean {
  switch (capability) {
    case "admin":
      // Non-admins never satisfy an admin capability at the app layer (RLS also
      // admin-walls these tables); a real-admin owner already returned above.
      return false;
    case "deal_terms":
      return resolveFieldAccess(profile).domainEditable("deal_terms");
    case "orders_view":
      return profile.modules.has("orders.view");
    case "suppliers_book":
      return profile.actions.has("counterparty:suppliers") && profile.modules.has("counterparties.suppliers");
    case "counterparty":
      // Coarse gate: the owner holds SOME CRM book (clients or suppliers). The FINE
      // per-org book scope (salesperson→clients / purchasing→suppliers, trader orgs
      // admin-only) is enforced inside the CRM tool handlers (contactGate /
      // resolveAddPersonScopeByProfile) with the target org.
      return (profile.actions.has("counterparty:clients") && profile.modules.has("counterparties.clients"))
        || (profile.actions.has("counterparty:suppliers") && profile.modules.has("counterparties.suppliers"));
    case "catalogue":
      return profile.modules.has("catalogue.view");
    default:
      return false;
  }
}

function userWriteDenialMessage(capability: UserWriteCapability): string {
  switch (capability) {
    case "admin":
      return "FORBIDDEN: this action is restricted to a platform administrator.";
    case "deal_terms":
      return "FORBIDDEN: this key's owner cannot edit deal terms (no deal-terms edit right).";
    case "orders_view":
      return "FORBIDDEN: this key's owner cannot manage deals (no Orders module).";
    case "suppliers_book":
      return "FORBIDDEN: this key's owner cannot start sourcing (no suppliers-book access).";
    case "counterparty":
      return "FORBIDDEN: this key's owner has no CRM book access (clients or suppliers).";
    case "catalogue":
      return "FORBIDDEN: this key's owner cannot edit catalog stock (no Catalogue module).";
    default:
      return "FORBIDDEN";
  }
}

// The deal-read field-wall projection (shouldProjectReads / projectDealForUser /
// projectSummariesForUser) moved verbatim into ./domains/deals.ts, where the two
// deal-read handlers use it. The SAME projectDealView wiring — unchanged.

// ── Tool dispatch ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: any, ctx: AuthCtx) {
  const def = TOOLS.find((t) => t.name === name);
  if (!def) return toolErr(`Unknown tool: ${name}`);
  if (!def.readOnly && ctx.role !== "full") {
    return toolErr(`Tool "${name}" requires a full-access token (this token is read-only).`);
  }

  // T2 · HIGH-1 · per-user WRITE authorization. The user JWT's RLS walls WHICH rows
  // a key may touch, but app-level authz (WHICH fields/actions a user may edit)
  // lives in the portal ACTION layer and is SKIPPED when MCP dispatches to services
  // directly. Re-apply the SAME capability the twin portal action checks, BEFORE
  // dispatch. The env owner token is the trusted owner-agent (admin/god) and bypasses
  // this — its blast radius is the deliberate FULL/READONLY split, not user authz.
  if (ctx.kind === "user" && !def.readOnly) {
    const denial = await authorizeUserWrite(name, ctx);
    if (denial) return toolErr(denial);
  }

  // db + actor come paired from the resolved auth context (env → admin+SERVICE_ACTOR,
  // user key → user-JWT client + user actor). The org/catalog/access/deal services
  // therefore run on the user JWT for a user key, so RLS applies the user's walls.
  // The ctx also lets deal READS be projected through the user's field wall (T2).
  const result = await dispatchTool(name, args, ctx);

  // Q5.2 · fire-and-forget audit for every successful mutation tool (reads are not
  // audited). The passed actor tags the row: SERVICE_ACTOR → actor_type='service'
  // (oscar-agent); a user actor → actor_type='service' + actor_user_id=<user> +
  // label mcp:<key-label>. MCP args never carry secrets. Never blocks the call.
  if (!def.readOnly && !result.isError) {
    void logAudit(
      {
        action: `mcp.${name}`,
        resourceType: "mcp_tool",
        resourceId: mcpResourceId(args),
        organisationId: ctx.kind === "user" ? ctx.orgId ?? undefined : undefined,
        metadata: mcpAuditMeta(args),
      },
      ctx.actor,
    );
  }
  return result;
}

/**
 * The dispatch handler lookup — the per-domain handler maps (each handler is the
 * exact body of that tool's former switch case) merged into one table. STABLE:
 * future per-domain work edits ./domains/*, never this aggregation.
 */
const HANDLERS: Record<string, ToolHandler> = {
  ...dealHandlers,
  ...crmHandlers,
  ...catalogHandlers,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchTool(name: string, args: any, ctx: AuthCtx) {
  const handler = HANDLERS[name];
  if (!handler) return toolErr(`Unhandled tool: ${name}`);
  return handler(args, ctx);
}

/** Q5.2 · best-effort resource id for an audited MCP mutation (the primary
 *  entity the tool acted on). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mcpResourceId(args: any): string | null {
  return (
    args?.deal_id ??
    args?.org_id ??
    args?.group_id ??
    args?.variant_id ??
    args?.user_id ??
    args?.spine_id ??
    null
  );
}

/** Q5.2 · compact, scalar-only snapshot of the MCP args for the audit metadata —
 *  arrays/objects are summarized so the row stays small (MCP args never carry
 *  secrets). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mcpAuditMeta(args: any): Record<string, unknown> | null {
  if (!args || typeof args !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (Array.isArray(v)) out[k] = `[${v.length} item(s)]`;
    else if (v && typeof v === "object") out[k] = "{…}";
    else out[k] = v as unknown;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// resolveCategoryId (catalog), mapSpineProductArgs + mapLineItemArgs (deals)
// moved verbatim into their ./domains/* modules alongside the handlers that use
// them. UUID_RE is imported from ./types (still used by resolveKeyOrg above).

// ── HTTP handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const bearer = extractBearer(req);
  if (!bearer) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Env owner tokens resolve synchronously, with no body — the trusted-path
  // behaviour is unchanged. A user key needs the request body (per-call org_id),
  // so parse before resolving that path.
  const envCtx = resolveEnvAuth(bearer);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  // A missing SUPABASE_JWT_SECRET (or any user-key resolution failure) throws /
  // returns null → 401. NEVER falls back to the admin client for a user key.
  let ctx: AuthCtx | null;
  try {
    ctx = envCtx ?? (await resolveUserKeyAuth(bearer, body));
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }
  if (!ctx) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { id, method, params } = body ?? {};

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "timber-mcp", version: "0.1.0" },
          capabilities: { tools: {} },
        });
      case "notifications/initialized":
        return rpcResult(id ?? null, {});
      case "tools/list": {
        const tools = TOOLS.filter((t) => ctx!.role === "full" || t.readOnly).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        return rpcResult(id, { tools });
      }
      case "tools/call": {
        const name = params?.name;
        const args = params?.arguments ?? {};
        if (!name) return rpcError(id, -32602, "Missing tool name");
        const result = await callTool(name, args, ctx);
        return rpcResult(id, result);
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return rpcError(id ?? null, -32603, `Internal error: ${(e as Error).message}`);
  }
}
