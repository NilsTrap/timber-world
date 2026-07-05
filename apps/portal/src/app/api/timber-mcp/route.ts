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
import type { ActorContext, DealSide, DealKind, DocType, TransportBilling, OrderExternalRef } from "@/features/orders/services/dealModel";
import { createDeal, getOrderDeal, listDeals, replaceLineItems, allocateDealCode, updateDealFields, setExternalRefs, setDealStatus, listDealsMissingDocs, startSourcing, setMarginApproval } from "@/features/orders/services/orderDeals";
import { assembleDocumentData, generateDocument, regenerateDocument } from "@/features/orders/services/orderDocuments";
import { getSpine, listSpineDeals, getSpineLineage } from "@/features/orders/services/spines";
import type { SpineProduct } from "@/features/orders/services/spines";
import { evaluateAdvance, advanceDeal, recordGateConfirmation, cancelDeal, listGateConfigs } from "@/features/orders/services/lifecycle";
import { listDefinitions, getOptions, listCategoryDefinitions } from "@/features/catalog/services/attributes";
import { getVariantStock, saveVariantStockEntry } from "@/features/catalog/services/stock";
import { listCatalogProducts, getCatalogVariant } from "@/features/catalog/services/products";
import { listOrgs, getOrg, createOrg, updateOrg } from "@/features/organisations/services/orgService";
import { listAccessGroups, getAccessGroupDetail, getUserAccessGroups, listPortalUsers } from "@/features/access/services/groupsRead";
import { createAccessGroup, updateAccessGroup, deleteAccessGroup, saveGroupRights, updateUserAccessGroups } from "@/features/access/services/groupsWrite";
import type { GroupRightsInput } from "@/features/access/types";
import { logAudit } from "@/features/audit/logAudit";
import { hashApiKey } from "@/lib/mcp/apiKeys";
import { resolveMcpUserActor } from "@/lib/mcp/resolveMcpUserActor";
import { getAccessProfile } from "@/lib/access";
import type { AccessProfile } from "@/lib/access/types";
import { resolveFieldAccess, projectDealView } from "@/features/orders/services/dealFields";
import type { OrderDealView, OrderDealSummary } from "@/features/orders/services/orderDeals";
import { TOOLS, USER_WRITE_CAPABILITY, type UserWriteCapability } from "./tools";

export const dynamic = "force-dynamic";

type Role = "full" | "readonly";

const SERVICE_ACTOR: ActorContext = {
  portalUserId: null,
  isPlatformAdmin: true,
  isServiceAgent: true,
  label: "oscar-agent",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolved auth context for a request. `db` + `actor` are always paired at the
 * source (env → admin+SERVICE_ACTOR, user → user-JWT client + user actor) so a
 * tool can never run an admin client with a user actor or vice-versa.
 */
type AuthCtx =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: "env"; role: Role; db: any; actor: ActorContext; orgId: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: "user"; role: Role; db: any; actor: ActorContext; orgId: string | null; keyId: string };

// Tool catalog (definitions) lives in ./tools; dispatch is below.

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
function toolOk(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data) }], isError: false };
}
function toolErr(message: string) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ── T2 · per-user write authorization + read field-wall projection ────────────
type UserCtx = Extract<AuthCtx, { kind: "user" }>;

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
    case "catalogue":
      return "FORBIDDEN: this key's owner cannot edit catalog stock (no Catalogue module).";
    default:
      return "FORBIDDEN";
  }
}

/** T2 · Should a deal READ be projected for this actor? Only a NON-admin user
 *  actor is walled; env tokens + real-admin user keys see the full view. */
function shouldProjectReads(ctx: AuthCtx): ctx is UserCtx {
  return ctx.kind === "user" && !ctx.actor.isPlatformAdmin;
}

/** Project one deal view through the key owner's field wall — the SAME
 *  projectDealView(view, resolveFieldAccess(profile), orgId) the portal Deal tab
 *  applies (chain / supplier / customer / margins / deal-terms hidden per grant). */
async function projectDealForUser(view: OrderDealView, ctx: UserCtx): Promise<OrderDealView> {
  const profile = await getAccessProfile(ctx.actor.portalUserId, ctx.orgId);
  return projectDealView(view, resolveFieldAccess(profile), ctx.orgId);
}

/** Project each list summary through the same wall. Row-level exclusion (a
 *  salesperson never sees BUY legs) is already enforced by the user JWT's RLS
 *  (side.buy visibility) on listDeals; here we only blank the walled header fields
 *  (chain / customer / supplier / deal terms), mirroring get_deal. */
async function projectSummariesForUser(rows: OrderDealSummary[], ctx: UserCtx): Promise<OrderDealSummary[]> {
  const profile = await getAccessProfile(ctx.actor.portalUserId, ctx.orgId);
  const access = resolveFieldAccess(profile);
  return rows.map((r) => {
    const projected = projectDealView({ ...r, lineItems: [] }, access, ctx.orgId);
    const { lineItems, ...rest } = projected;
    void lineItems; // summary carries no line items — drop the empty array we added
    return rest as OrderDealSummary;
  });
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchTool(name: string, args: any, ctx: AuthCtx) {
  const { db, actor } = ctx;
  switch (name) {
    case "timber_get_attribute_definitions": {
      const res = await listDefinitions(db);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_category_fields": {
      const categoryId = await resolveCategoryId(db, args);
      if (!categoryId.ok) return toolErr(categoryId.error);
      const res = await listCategoryDefinitions(db, categoryId.id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_attribute_options": {
      if (!args?.attribute_key) return toolErr("attribute_key is required");
      const res = await getOptions(db, args.attribute_key);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_catalog_products": {
      const categoryId = await resolveCategoryId(db, args);
      if (!categoryId.ok) return toolErr(categoryId.error);
      const res = await listCatalogProducts(db, categoryId.id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_catalog_variant": {
      if (!args?.variant_id) return toolErr("variant_id is required");
      const res = await getCatalogVariant(db, args.variant_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_variant_stock": {
      if (!args?.variant_id) return toolErr("variant_id is required");
      const res = await getVariantStock(db, args.variant_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_set_variant_stock": {
      if (!args?.variant_id || !args?.packaging_type_id) return toolErr("variant_id and packaging_type_id are required");
      if (typeof args?.quantity !== "number") return toolErr("quantity (number) is required");
      const res = await saveVariantStockEntry(db, {
        variantId: args.variant_id,
        packagingTypeId: args.packaging_type_id,
        quantity: args.quantity,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_orgs": {
      const res = await listOrgs(db, { query: args?.query, limit: args?.limit });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_org": {
      if (!args?.org_id) return toolErr("org_id is required");
      const res = await getOrg(db, args.org_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_create_org": {
      if (!args?.code || !args?.name) return toolErr("code and name are required");
      const res = await createOrg(db, {
        code: args.code,
        name: args.name,
        legalAddress: args?.legal_address,
        vatNumber: args?.vat_number,
        registrationNumber: args?.registration_number,
        country: args?.country,
        phone: args?.phone,
        email: args?.email,
        website: args?.website,
        bankName: args?.bank_name,
        bankAccountNumber: args?.bank_account_number,
        bankSwiftCode: args?.bank_swift_code,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_update_org": {
      if (!args?.org_id) return toolErr("org_id is required");
      const res = await updateOrg(db, args.org_id, {
        // Pass code through so an explicit change attempt is REJECTED (immutable),
        // rather than silently ignored — the tool schema doesn't advertise it.
        code: args?.code,
        name: args?.name,
        legalAddress: args?.legal_address,
        vatNumber: args?.vat_number,
        registrationNumber: args?.registration_number,
        country: args?.country,
        phone: args?.phone,
        email: args?.email,
        website: args?.website,
        bankName: args?.bank_name,
        bankAccountNumber: args?.bank_account_number,
        bankSwiftCode: args?.bank_swift_code,
        defaultSigneeName: args?.default_signee_name,
        defaultSigneeRole: args?.default_signee_role,
        isCustomer: args?.is_customer,
        isManufacturer: args?.is_manufacturer,
        isProducer: args?.is_producer,
        isSupplier: args?.is_supplier,
        isActive: args?.is_active,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_deals": {
      const res = await listDeals(db, actor, {
        status: args?.status,
        productGroup: args?.product_group,
        limit: args?.limit,
      });
      if (!res.success) return toolErr(res.error);
      // T2 · field-wall projection for a non-admin user key (RLS already excludes
      // buy legs via side.buy visibility); env/admin see the full summaries.
      const data = shouldProjectReads(ctx) ? await projectSummariesForUser(res.data, ctx) : res.data;
      return toolOk(data);
    }
    case "timber_get_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await getOrderDeal(db, actor, args.deal_id);
      if (!res.success) return toolErr(res.error);
      // T2 · project the deal through the key owner's field wall (chain / supplier /
      // customer / margins / deal terms) — the SAME projection as the portal Deal tab.
      const data = shouldProjectReads(ctx) ? await projectDealForUser(res.data, ctx) : res.data;
      return toolOk(data);
    }
    case "timber_create_deal": {
      if (args?.needs_sourcing && !args?.source_organisation_id) {
        return toolErr("source_organisation_id is required when needs_sourcing is true.");
      }
      const res = await createDeal(db, actor, {
        name: args?.name ?? null,
        productGroup: args?.product_group ?? null,
        currency: args?.currency,
        customerNameForCode: args?.customer_name ?? null,
        customerOrganisationId: args?.customer_organisation_id ?? null,
        buyerOrganisationId: args?.buyer_organisation_id ?? null,
        sellerOrganisationId: args?.seller_organisation_id ?? null,
        producerOrganisationId: args?.producer_organisation_id ?? null,
        needsSourcing: args?.needs_sourcing ?? false,
        sourceOrganisationId: args?.source_organisation_id ?? null,
        spineProduct: mapSpineProductArgs(args?.spine_product),
        incoterms: args?.incoterms ?? null,
        incotermsPlace: args?.incoterms_place ?? null,
        advancePct: args?.advance_pct ?? null,
        paymentTerms: args?.payment_terms ?? null,
        deliveryTerms: args?.delivery_terms ?? null,
        deliveryDeadline: args?.delivery_deadline ?? null,
        notes: args?.notes ?? null,
        idempotencyKey: args?.idempotency_key ?? null,
        // L1 · spine-Lego leg: join an origin deal's spine + copy its lines (blank prices).
        originDealId: args?.origin_deal_id ?? null,
        copyLines: args?.copy_lines,
        lineItems: mapLineItemArgs(args?.line_items),
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_upsert_deal_line_items": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      // A5 (§2.1): a deal carries only its OWN lines (always stored side='sell').
      // The `side` arg is DEPRECATED and ignored — buy-side goods live on the
      // separate buy-leg deal (upsert them by targeting that deal's id). Forcing
      // 'sell' guarantees no new side='buy' writes.
      const res = await replaceLineItems(db, actor, args.deal_id, "sell", mapLineItemArgs(args?.items));
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_allocate_deal_code": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await allocateDealCode(db, actor, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_update_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await updateDealFields(db, actor, args.deal_id, {
        dealKind: args?.deal_kind as DealKind | undefined,
        productGroup: args?.product_group,
        incoterms: args?.incoterms,
        incotermsPlace: args?.incoterms_place,
        advancePct: args?.advance_pct,
        paymentTerms: args?.payment_terms,
        deliveryTerms: args?.delivery_terms,
        deliveryDeadline: args?.delivery_deadline,
        transportBilling: args?.transport_billing as TransportBilling | undefined,
        // G3 · per-deal signee overrides (seller/buyer signature blocks on docs).
        sellerSigneeName: args?.seller_signee_name,
        sellerSigneeRole: args?.seller_signee_role,
        buyerSigneeName: args?.buyer_signee_name,
        buyerSigneeRole: args?.buyer_signee_role,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_start_sourcing": {
      if (!args?.deal_id || !args?.supplier_organisation_id) return toolErr("deal_id and supplier_organisation_id are required");
      // L1 · buyer defaults to the sell deal's seller but is editable (wrong-buyer fix).
      const res = await startSourcing(db, actor, args.deal_id, args.supplier_organisation_id, args?.buyer_organisation_id ?? null);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }

    case "timber_set_margin_approval": {
      if (!args?.deal_id || typeof args?.approved !== "boolean") return toolErr("deal_id and approved (boolean) are required");
      const res = await setMarginApproval(db, actor, args.deal_id, args.approved);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_set_deal_refs": {
      if (!args?.deal_id || !Array.isArray(args?.refs)) return toolErr("deal_id and refs[] are required");
      // Settable ref types: the client refs, the N3 canonical party order numbers,
      // and a generic 'custom'. 'other' is reserved for the internal idempotency
      // marker (idem:<key>) — exposing it would let a caller poison create-deal
      // idempotency, and setExternalRefs never clears 'other'.
      const ALLOWED_REF_TYPES = ["client_project", "client_job", "client_po", "customer_order_no", "supplier_order_no", "custom"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.refs.some((r: any) => !ALLOWED_REF_TYPES.includes(r?.ref_type))) {
        return toolErr(`Each ref_type must be one of: ${ALLOWED_REF_TYPES.join(", ")}.`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs: OrderExternalRef[] = args.refs.map((r: any) => ({ refType: r.ref_type, refValue: r.ref_value, label: r.label ?? null }));
      const res = await setExternalRefs(db, actor, args.deal_id, refs);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_document_data": {
      if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
      if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
      const res = await assembleDocumentData(db, actor, {
        orderId: args.deal_id,
        docType: args.doc_type as DocType,
        side: args?.side as DealSide | undefined,
      });
      return res.success ? toolOk(res.data.data) : toolErr(res.error);
    }
    case "timber_generate_document": {
      if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
      if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
      const res = await generateDocument(db, actor, {
        orderId: args.deal_id,
        docType: args.doc_type as DocType,
        side: args?.side as DealSide | undefined,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_firm_order_specification": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      // regenerateDocument targets a document row by id. When the caller gives only
      // the deal, resolve its newest sales_spec (the doc that carries quotation/firm
      // state) — same lookup the portal makes before the "make firm" click.
      let documentId: string | undefined = args?.document_id;
      if (!documentId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: doc } = await (db as any)
          .from("order_documents")
          .select("id")
          .eq("order_id", args.deal_id)
          .eq("doc_type", "sales_spec")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!doc) return toolErr("No sales specification document found on this deal to firm — generate the quotation first.");
        documentId = doc.id as string;
      }
      const res = await regenerateDocument(db, actor, { documentId, docState: "firm" });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_set_deal_status": {
      if (!args?.deal_id || !args?.status) return toolErr("deal_id and status are required");
      const res = await setDealStatus(db, actor, args.deal_id, args.status);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_deals_missing_docs": {
      if (!args?.doc_type) return toolErr("doc_type is required");
      const res = await listDealsMissingDocs(db, actor, { docType: args.doc_type as DocType, limit: args?.limit });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    // ── E7: spine reads (chain + rollup + lineage) ────────────────────────────
    case "timber_get_spine": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      // §6.2: the full spine/chain overview is owner-only — a non-admin user key must
      // not read cross-leg rollup. The env owner token is isPlatformAdmin=true.
      if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
      const res = await getSpine(db, actor, args.spine_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_spine_deals": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
      const res = await listSpineDeals(db, actor, args.spine_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_spine_lineage": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
      const res = await getSpineLineage(db, actor, args.spine_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    // ── E7: lifecycle gates (read + advance a deal's stage) ───────────────────
    case "timber_get_advance_status": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await evaluateAdvance(db, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_gate_configs": {
      const res = await listGateConfigs(db);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_advance_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await advanceDeal(db, actor, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_record_gate_confirmation": {
      if (!args?.deal_id || !args?.from_stage || !args?.block_type || !args?.block_key) {
        return toolErr("deal_id, from_stage, block_type and block_key are required");
      }
      if (args.block_type !== "party_signoff" && args.block_type !== "acceptance") {
        return toolErr("block_type must be 'party_signoff' or 'acceptance'");
      }
      const res = await recordGateConfirmation(db, actor, {
        orderId: args.deal_id,
        fromStage: args.from_stage,
        blockType: args.block_type,
        blockKey: args.block_key,
        confirmedByOrg: args?.confirmed_by_org ?? null,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_cancel_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await cancelDeal(db, actor, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    // ── E7: user / access-group management (read surface) ─────────────────────
    case "timber_list_access_groups": {
      const res = await listAccessGroups(db);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_access_group": {
      if (!args?.group_id) return toolErr("group_id is required");
      const res = await getAccessGroupDetail(db, args.group_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_user_access_groups": {
      if (!args?.user_id || !args?.organisation_id) return toolErr("user_id and organisation_id are required");
      const res = await getUserAccessGroups(db, args.user_id, args.organisation_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_users": {
      const res = await listPortalUsers(db, { query: args?.query, orgId: args?.org_id, limit: args?.limit });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    // ── J3: access-group / user-group WRITES (full-token only) ────────────────
    // NOTE: these mutate the DB directly and cannot bust the portal's per-member
    // next/cache tags (only a request-scoped action can) — affected users' cached
    // effective permissions refresh on their next natural revalidation.
    case "timber_set_user_groups": {
      if (!args?.user_id || !args?.organisation_id || !Array.isArray(args?.group_ids)) {
        return toolErr("user_id, organisation_id and group_ids[] are required");
      }
      const res = await updateUserAccessGroups(db, args.user_id, args.organisation_id, args.group_ids);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_upsert_access_group": {
      let groupId: string | undefined = args?.group_id;
      if (groupId) {
        // Update name/description if provided.
        if (args?.name !== undefined || args?.description !== undefined) {
          const upd = await updateAccessGroup(db, groupId, { name: args?.name, description: args?.description });
          if (!upd.success) return toolErr(upd.error);
        }
      } else {
        if (!args?.name) return toolErr("name is required to create a group (or pass group_id to update)");
        const created = await createAccessGroup(db, { name: args.name, description: args?.description });
        if (!created.success) return toolErr(created.error);
        groupId = created.data.id;
      }
      // Optional FULL-REPLACE of the rights matrix.
      if (args?.rights && typeof args.rights === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = args.rights as any;
        const rights: GroupRightsInput = {
          modules: Array.isArray(r.modules) ? r.modules : [],
          dealVisibility: Array.isArray(r.deal_visibility) ? r.deal_visibility : [],
          fieldDomains: r.field_domains && typeof r.field_domains === "object" ? r.field_domains : {},
          fieldOverrides: r.field_overrides && typeof r.field_overrides === "object" ? r.field_overrides : {},
          scope: r.scope === "company" || r.scope === "all" ? r.scope : "mine",
          actions: Array.isArray(r.actions) ? r.actions : [],
        };
        const saved = await saveGroupRights(db, groupId, rights);
        if (!saved.success) return toolErr(saved.error);
      }
      return toolOk({ id: groupId });
    }
    case "timber_delete_access_group": {
      if (!args?.group_id) return toolErr("group_id is required");
      // Mirror the UI's destructive warning: refuse if the group has members unless
      // force is set (the UI shows "N user assignments will be removed" + confirm).
      if (!args?.force) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (db as any)
          .from("user_access_groups")
          .select("user_id", { count: "exact", head: true })
          .eq("group_id", args.group_id);
        if ((count ?? 0) > 0) {
          return toolErr(`This group has ${count} user assignment(s); deleting removes them. Re-call with force=true to confirm.`);
        }
      }
      const res = await deleteAccessGroup(db, args.group_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    default:
      return toolErr(`Unhandled tool: ${name}`);
  }
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

/**
 * Resolve a catalog category id from either a category_id (UUID) or a
 * category_slug arg (shared by timber_get_category_fields + list_catalog_products).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCategoryId(db: any, args: any): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const slug: string | null =
    args?.category_slug ?? (args?.category_id && !UUID_RE.test(args.category_id) ? args.category_id : null);
  let categoryId: string | null = args?.category_id && UUID_RE.test(args.category_id) ? args.category_id : null;
  if (!categoryId && slug) {
    const { data: cat } = await db.from("catalog_categories").select("id").eq("slug", slug).maybeSingle();
    if (!cat) return { ok: false, error: `No category found for slug "${slug}"` };
    categoryId = cat.id as string;
  }
  if (!categoryId) return { ok: false, error: "category_id (UUID) or category_slug is required" };
  return { ok: true, id: categoryId };
}

/**
 * Normalize the create_deal `spine_product` arg (snake_case, like every other
 * MCP arg) into the SpineProduct shape the spine writer reads (camelCase). Every
 * sibling arg is snake_case, so an agent supplies snake_case here too — without
 * this mapper the spine's product columns would be silently dropped. Also
 * tolerates camelCase for robustness. Absent keys stay absent (column untouched).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSpineProductArgs(p: any): Partial<SpineProduct> | undefined {
  if (!p || typeof p !== "object") return undefined;
  const pick = (snake: string, camel: string) => (snake in p ? p[snake] : camel in p ? p[camel] : undefined);
  const out: Partial<SpineProduct> = {};
  const set = (k: keyof SpineProduct, v: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (v !== undefined) (out as any)[k] = v ?? null;
  };
  set("woodSpecies", pick("wood_species", "woodSpecies"));
  set("productType", pick("product_type", "productType"));
  set("processing", pick("processing", "processing"));
  set("quality", pick("quality", "quality"));
  set("certificate", pick("certificate", "certificate"));
  set("thickness", pick("thickness", "thickness"));
  set("width", pick("width", "width"));
  set("length", pick("length", "length"));
  set("pieces", pick("pieces", "pieces"));
  set("volumeM3", pick("volume_m3", "volumeM3"));
  return Object.keys(out).length > 0 ? out : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLineItemArgs(items: any): any[] {
  if (!Array.isArray(items)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((it: any, i: number) => ({
    lineNo: it.line_no ?? i + 1,
    side: it.side ?? "sell",
    productName: it.product_name ?? null,
    woodSpecies: it.wood_species ?? null,
    humidity: it.humidity ?? null,
    processing: it.processing ?? null,
    quality: it.quality ?? null,
    gradeNote: it.grade_note ?? null,
    thickness: it.thickness ?? null,
    width: it.width ?? null,
    length: it.length ?? null,
    pieces: it.pieces != null ? String(it.pieces) : null,
    volumeM3: it.volume_m3 ?? null,
    unit: it.unit ?? "m3",
    unitPriceCents: it.unit_price_cents ?? null,
    vatRate: it.vat_rate ?? null,
    lineTotalCents: it.line_total_cents ?? null,
    notes: it.notes ?? null,
  }));
}

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
