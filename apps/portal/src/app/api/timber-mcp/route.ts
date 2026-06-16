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
import type { ActorContext, DealSide, DocType } from "@/features/deals/types";
import { createDeal, getDeal, listDeals, replaceLineItems } from "@/features/deals/services/dealsService";
import { generateDocument } from "@/features/deals/services/documentService";

export const dynamic = "force-dynamic";

type Role = "full" | "readonly";

const SERVICE_ACTOR: ActorContext = {
  portalUserId: null,
  isPlatformAdmin: true,
  isServiceAgent: true,
  label: "oscar-agent",
};

// ── Tool catalog ─────────────────────────────────────────────────────────────
interface ToolDef {
  name: string;
  description: string;
  readOnly: boolean;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "timber_list_deals",
    description: "List deals (trade records), newest first. Filter by status or product group.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: draft, quoted, confirmed, in_progress, shipped, completed, cancelled." },
        product_group: { type: "string", description: "Filter by product group, e.g. 'malka' or 'boards'." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
  {
    name: "timber_get_deal",
    description: "Get one deal by id, including its line items, external reference codes and generated documents.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal UUID." } },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_create_deal",
    description:
      "Create a new deal (trade record). Use after extracting an order from an email, voice note, or meeting transcript. Returns the created deal with its generated code. Pass idempotency_key to make repeated calls safe.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        product_group: { type: "string", description: "Product group, e.g. 'malka', 'boards'." },
        currency: { type: "string", enum: ["EUR", "GBP", "USD"], description: "Deal currency (default EUR)." },
        customer_name: { type: "string", description: "Buyer name (used for the deal code when no org row exists)." },
        customer_organisation_id: { type: "string", description: "Buyer organisation UUID, if known." },
        seller_organisation_id: { type: "string", description: "Selling/trading entity organisation UUID (defaults to Timber International)." },
        producer_organisation_id: { type: "string", description: "Producer organisation UUID (buy side), if known." },
        incoterms: { type: "string", description: "Incoterms code, e.g. FCA, EXW, DAP." },
        incoterms_place: { type: "string", description: "Incoterms place." },
        advance_pct: { type: "number", description: "Advance percentage 0–100 for this deal." },
        payment_terms: { type: "string", description: "Free-text payment terms." },
        delivery_terms: { type: "string", description: "Free-text delivery terms." },
        delivery_deadline: { type: "string", description: "Delivery deadline (free text, e.g. 'July 2026')." },
        notes: { type: "string", description: "Free-text notes." },
        idempotency_key: { type: "string", description: "Stable key to dedupe repeated creates from a retried workflow." },
        line_items: {
          type: "array",
          description: "Sell-side line items. Each: {product_name, wood_species, humidity, processing, quality, thickness, width, length, pieces, volume_m3, unit, unit_price_cents, vat_rate}.",
          items: { type: "object" },
        },
      },
    },
  },
  {
    name: "timber_upsert_deal_line_items",
    description: "Replace all line items for a deal side ('sell' or 'buy') with the provided list. Idempotent (full replace).",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        side: { type: "string", enum: ["sell", "buy"], description: "Which side's items to replace (default 'sell')." },
        items: { type: "array", description: "Line items (see timber_create_deal.line_items shape).", items: { type: "object" } },
      },
      required: ["deal_id", "items"],
    },
  },
  {
    name: "timber_generate_document",
    description:
      "Generate a PDF document for a deal (sales_spec or purchase_spec available now) and return its number and a signed download URL. Records the document on the deal.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        doc_type: { type: "string", enum: ["sales_spec", "purchase_spec"], description: "Document type to generate." },
        side: { type: "string", enum: ["sell", "buy"], description: "Override side (defaults from doc_type)." },
      },
      required: ["deal_id", "doc_type"],
    },
  },
];

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
      const res = await getDeal(db, SERVICE_ACTOR, args.deal_id);
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    case "timber_create_deal": {
      const res = await createDeal(db, SERVICE_ACTOR, {
        productGroup: args?.product_group ?? null,
        currency: args?.currency,
        customerNameForCode: args?.customer_name ?? null,
        customerOrganisationId: args?.customer_organisation_id ?? null,
        sellerOrganisationId: args?.seller_organisation_id ?? null,
        producerOrganisationId: args?.producer_organisation_id ?? null,
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
    case "timber_generate_document": {
      if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
      const res = await generateDocument(db, SERVICE_ACTOR, {
        dealId: args.deal_id,
        docType: args.doc_type as DocType,
        side: args?.side as DealSide | undefined,
      });
      return res.success ? toolOk(res.data) : toolErr(res.error);
    }
    default:
      return toolErr(`Unhandled tool: ${name}`);
  }
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
