/**
 * Timber MCP endpoint — JSON-RPC 2.0 over HTTP for Oscar Workflows.
 *
 * Implements the Oscar "Workflows v1 for MCP builders" contract (§3/§4):
 *  - initialize / notifications/initialized / tools/list / tools/call
 *  - tools return { content: [{type:"text", text: <JSON string>}], isError }
 *  - read tools named *_list / *_get; mutations are never auto-retried (Oscar
 *    can't know they're safe), so every tool is idempotent or one-attempt-safe.
 *
 * Auth: bearer token → role. Two tokens (split, decided 2026-06-13):
 *   TIMBER_MCP_TOKEN_FULL      → full access (workflow engine)
 *   TIMBER_MCP_TOKEN_READONLY  → read-only (chat agents; prompt-injection blast
 *                                radius containment)
 * The service identity uses the admin client (RLS-bypassing) and is trusted.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActorContext, DealSide, DealKind, DocType, TransportBilling, OrderExternalRef } from "@/features/orders/services/dealModel";
import { createDeal, getOrderDeal, listDeals, replaceLineItems, allocateDealCode, updateDealFields, setExternalRefs, setDealStatus, listDealsMissingDocs } from "@/features/orders/services/orderDeals";
import { assembleDocumentData, generateDocument } from "@/features/orders/services/orderDocuments";
import { getSpine, listSpineDeals, getSpineLineage } from "@/features/orders/services/spines";
import type { SpineProduct } from "@/features/orders/services/spines";
import { evaluateAdvance, advanceDeal, recordGateConfirmation, cancelDeal, listGateConfigs } from "@/features/orders/services/lifecycle";
import { listDefinitions, getOptions, listCategoryDefinitions } from "@/features/catalog/services/attributes";
import { listOrgs, getOrg, createOrg } from "@/features/organisations/services/orgService";
import { listAccessGroups, getAccessGroupDetail, getUserAccessGroups, listPortalUsers } from "@/features/access/services/groupsRead";
import { TOOLS } from "./tools";

export const dynamic = "force-dynamic";

type Role = "full" | "readonly";

const SERVICE_ACTOR: ActorContext = {
  portalUserId: null,
  isPlatformAdmin: true,
  isServiceAgent: true,
  label: "oscar-agent",
};

// Tool catalog (definitions) lives in ./tools; dispatch is below.

// ── Auth ─────────────────────────────────────────────────────────────────────
function resolveRole(req: Request): Role | null {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = (m[1] ?? "").trim();
  const full = process.env.TIMBER_MCP_TOKEN_FULL;
  const readonly = process.env.TIMBER_MCP_TOKEN_READONLY;
  if (full && token === full) return "full";
  if (readonly && token === readonly) return "readonly";
  return null;
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

// ── Tool dispatch ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: any, role: Role) {
  const def = TOOLS.find((t) => t.name === name);
  if (!def) return toolErr(`Unknown tool: ${name}`);
  if (!def.readOnly && role !== "full") {
    return toolErr(`Tool "${name}" requires a full-access token (this token is read-only).`);
  }

  const db = createAdminClient();

  switch (name) {
    case "timber_get_attribute_definitions": {
      const res = await listDefinitions(db);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_category_fields": {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Resolve the category by explicit slug, or by category_id when it isn't a UUID.
      const slug: string | null =
        args?.category_slug ?? (args?.category_id && !UUID_RE.test(args.category_id) ? args.category_id : null);
      let categoryId: string | null = args?.category_id && UUID_RE.test(args.category_id) ? args.category_id : null;
      if (!categoryId && slug) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cat } = await (db as any)
          .from("catalog_categories")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!cat) return toolErr(`No category found for slug "${slug}"`);
        categoryId = cat.id as string;
      }
      if (!categoryId) return toolErr("category_id (UUID) or category_slug is required");
      const res = await listCategoryDefinitions(db, categoryId);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_attribute_options": {
      if (!args?.attribute_key) return toolErr("attribute_key is required");
      const res = await getOptions(db, args.attribute_key);
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
    case "timber_list_deals": {
      const res = await listDeals(db, SERVICE_ACTOR, {
        status: args?.status,
        productGroup: args?.product_group,
        limit: args?.limit,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await getOrderDeal(db, SERVICE_ACTOR, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_create_deal": {
      if (args?.needs_sourcing && !args?.source_organisation_id) {
        return toolErr("source_organisation_id is required when needs_sourcing is true.");
      }
      const res = await createDeal(db, SERVICE_ACTOR, {
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
        lineItems: mapLineItemArgs(args?.line_items),
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_upsert_deal_line_items": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const side: DealSide = args?.side === "buy" ? "buy" : "sell";
      const res = await replaceLineItems(db, SERVICE_ACTOR, args.deal_id, side, mapLineItemArgs(args?.items));
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_allocate_deal_code": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await allocateDealCode(db, SERVICE_ACTOR, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_update_deal": {
      if (!args?.deal_id) return toolErr("deal_id is required");
      const res = await updateDealFields(db, SERVICE_ACTOR, args.deal_id, {
        dealKind: args?.deal_kind as DealKind | undefined,
        productGroup: args?.product_group,
        incoterms: args?.incoterms,
        incotermsPlace: args?.incoterms_place,
        advancePct: args?.advance_pct,
        paymentTerms: args?.payment_terms,
        deliveryTerms: args?.delivery_terms,
        deliveryDeadline: args?.delivery_deadline,
        transportBilling: args?.transport_billing as TransportBilling | undefined,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_set_deal_refs": {
      if (!args?.deal_id || !Array.isArray(args?.refs)) return toolErr("deal_id and refs[] are required");
      // Only the client ref types are settable here. 'other' is reserved for the
      // internal idempotency marker (idem:<key>) — exposing it would let a caller
      // poison create-deal idempotency, and setExternalRefs never clears 'other'.
      const ALLOWED_REF_TYPES = ["client_project", "client_job", "client_po"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.refs.some((r: any) => !ALLOWED_REF_TYPES.includes(r?.ref_type))) {
        return toolErr(`Each ref_type must be one of: ${ALLOWED_REF_TYPES.join(", ")}.`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs: OrderExternalRef[] = args.refs.map((r: any) => ({ refType: r.ref_type, refValue: r.ref_value, label: r.label ?? null }));
      const res = await setExternalRefs(db, SERVICE_ACTOR, args.deal_id, refs);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_document_data": {
      if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
      if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
      const res = await assembleDocumentData(db, SERVICE_ACTOR, {
        orderId: args.deal_id,
        docType: args.doc_type as DocType,
        side: args?.side as DealSide | undefined,
      });
      return res.success ? toolOk(res.data.data) : toolErr(res.error);
    }
    case "timber_generate_document": {
      if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
      if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
      const res = await generateDocument(db, SERVICE_ACTOR, {
        orderId: args.deal_id,
        docType: args.doc_type as DocType,
        side: args?.side as DealSide | undefined,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_set_deal_status": {
      if (!args?.deal_id || !args?.status) return toolErr("deal_id and status are required");
      const res = await setDealStatus(db, SERVICE_ACTOR, args.deal_id, args.status);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_deals_missing_docs": {
      if (!args?.doc_type) return toolErr("doc_type is required");
      const res = await listDealsMissingDocs(db, SERVICE_ACTOR, { docType: args.doc_type as DocType, limit: args?.limit });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    // ── E7: spine reads (chain + rollup + lineage) ────────────────────────────
    case "timber_get_spine": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      const res = await getSpine(db, SERVICE_ACTOR, args.spine_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_list_spine_deals": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      const res = await listSpineDeals(db, SERVICE_ACTOR, args.spine_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_get_spine_lineage": {
      if (!args?.spine_id) return toolErr("spine_id is required");
      const res = await getSpineLineage(db, SERVICE_ACTOR, args.spine_id);
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
      const res = await advanceDeal(db, SERVICE_ACTOR, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_record_gate_confirmation": {
      if (!args?.deal_id || !args?.from_stage || !args?.block_type || !args?.block_key) {
        return toolErr("deal_id, from_stage, block_type and block_key are required");
      }
      if (args.block_type !== "party_signoff" && args.block_type !== "acceptance") {
        return toolErr("block_type must be 'party_signoff' or 'acceptance'");
      }
      const res = await recordGateConfirmation(db, SERVICE_ACTOR, {
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
      const res = await cancelDeal(db, SERVICE_ACTOR, args.deal_id);
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
    default:
      return toolErr(`Unhandled tool: ${name}`);
  }
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
  const role = resolveRole(req);
  if (!role) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
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
        const tools = TOOLS.filter((t) => role === "full" || t.readOnly).map((t) => ({
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
        const result = await callTool(name, args, role);
        return rpcResult(id, result);
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return rpcError(id ?? null, -32603, `Internal error: ${(e as Error).message}`);
  }
}
