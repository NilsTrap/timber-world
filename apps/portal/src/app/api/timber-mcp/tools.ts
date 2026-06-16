/**
 * Timber MCP tool catalog (definitions only — dispatch lives in route.ts).
 *
 * Each tool carries a `lifecycle` tag mapping it to a step of the deal lifecycle;
 * the MCP-coverage check (tools-coverage.test.ts) asserts every step in
 * LIFECYCLE_STEPS is served by ≥1 tool, enforcing the completeness rule
 * (every deterministic lifecycle step is MCP-callable — no UI-only mutations).
 */

/** Deterministic deal-lifecycle steps that MUST each have at least one MCP tool. */
export const LIFECYCLE_STEPS = [
  "vocabulary",   // controlled vocab for intake (attributes)
  "org",          // organisations: create/link/read (CRM-synced)
  "deal_create",  // create a deal from intake
  "deal_read",    // list/get deals
  "line_items",   // set the deal's line items
  "deal_update",  // amend deal fields / external refs
  "numbering",    // allocate Timber deal/document numbers
  "documents",    // assemble + generate/store documents
  "status",       // operational fulfilment status transitions
  "doc_chasing",  // find deals missing required documents
] as const;

export type LifecycleStep = (typeof LIFECYCLE_STEPS)[number];

export interface ToolDef {
  name: string;
  description: string;
  readOnly: boolean;
  lifecycle: LifecycleStep;
  inputSchema: Record<string, unknown>;
}

const DOC_TYPE_ENUM = ["sales_spec", "purchase_spec", "contract", "proforma_invoice", "invoice", "packing_list", "cmr"];
const STATUS_ENUM = ["draft", "pending", "confirmed", "in_progress", "shipped", "completed", "loaded", "cancelled"];

export const TOOLS: ToolDef[] = [
  {
    name: "timber_get_attribute_definitions",
    description:
      "List the controlled-vocabulary attribute definitions (deal/line-item fields like species, quality, humidity, processing, plus the dimension fields). Returns each attribute's key, label, type, unit and active-option count. Call this first to learn the valid keys, then timber_list_attribute_options for a key's allowed values.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_list_attribute_options",
    description:
      "List the allowed options (value + label) for one attribute, identified by its key (from timber_get_attribute_definitions). Use these exact values when creating deals/line items so they match the controlled vocabulary. Returns only active options.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: {
      type: "object",
      properties: {
        attribute_key: { type: "string", description: "Attribute key, e.g. 'wood_species' or 'quality' (from timber_get_attribute_definitions)." },
      },
      required: ["attribute_key"],
    },
  },
  {
    name: "timber_list_orgs",
    description: "List Timber organisations (customers/manufacturers/producers) with their company card + CRM link. Optional text query matches name or code.",
    readOnly: true,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by name or code (substring)." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
  {
    name: "timber_get_org",
    description: "Get one Timber organisation by id — full company card (legal address, VAT/registration, country, contact, bank) + role flags + crm_org_id.",
    readOnly: true,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: { org_id: { type: "string", description: "Organisation UUID." } },
      required: ["org_id"],
    },
  },
  {
    name: "timber_create_org",
    description: "Create a Timber organisation (3-char code + name + optional company card). Mirrors to the Oscar CRM when configured and returns the stored org incl. crm_org_id.",
    readOnly: false,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "3-char org code (letter + 2 letters/digits, e.g. SOM)." },
        name: { type: "string", description: "Organisation name." },
        legal_address: { type: "string" },
        vat_number: { type: "string" },
        registration_number: { type: "string" },
        country: { type: "string", description: "ISO-3166 alpha-2 (e.g. LV, GB)." },
        phone: { type: "string" },
        email: { type: "string" },
        website: { type: "string" },
        bank_name: { type: "string" },
        bank_account_number: { type: "string" },
        bank_swift_code: { type: "string" },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "timber_list_deals",
    description: "List deals (trade records), newest first. Filter by status or product group.",
    readOnly: true,
    lifecycle: "deal_read",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: draft, pending, confirmed, in_progress, shipped, loaded, completed, cancelled." },
        product_group: { type: "string", description: "Filter by product group, e.g. 'malka' or 'boards'." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
  {
    name: "timber_get_deal",
    description: "Get one deal by id, including its line items, external reference codes and generated documents.",
    readOnly: true,
    lifecycle: "deal_read",
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
    lifecycle: "deal_create",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short deal name/label (defaults to the customer or product group if omitted)." },
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
    lifecycle: "line_items",
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
    name: "timber_update_deal",
    description: "Update a deal's header fields (deal kind, product group, incoterms, advance %, payment/delivery terms + deadline, transport billing). Only the provided fields change. Idempotent.",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        deal_kind: { type: "string", enum: ["buy_sell", "sale_only", "purchase_only"] },
        product_group: { type: "string" },
        incoterms: { type: "string" },
        incoterms_place: { type: "string" },
        advance_pct: { type: "number" },
        payment_terms: { type: "string" },
        delivery_terms: { type: "string" },
        delivery_deadline: { type: "string" },
        transport_billing: { type: "string", enum: ["in_price", "separate_line", "separate_invoice"] },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_set_deal_refs",
    description: "Replace a deal's client external reference codes (project / job / PO). Idempotent (full replace; internal idempotency markers preserved).",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        refs: {
          type: "array",
          description: "Client external refs. Each: {ref_type: 'client_project'|'client_job'|'client_po', ref_value, label?}.",
          items: { type: "object" },
        },
      },
      required: ["deal_id", "refs"],
    },
  },
  {
    name: "timber_allocate_deal_code",
    description:
      "Allocate (or return, if already set) the Timber deal code for a deal — the Nils-convention ENTITY+CLIENT+SEQ code (e.g. TIMSOM001). Idempotent. Timber owns deal/document numbering.",
    readOnly: false,
    lifecycle: "numbering",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal (order) UUID." } },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_get_document_data",
    description:
      "Assemble the full render-ready data for a deal document (parties' company cards, line items, totals, VAT rule + reference, amount-in-words, and a freshly-allocated Timber document number). This is the structured input the document generator turns into a file. Allocates a document number (Timber owns numbering).",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        doc_type: { type: "string", enum: DOC_TYPE_ENUM, description: "Document type." },
        side: { type: "string", enum: ["sell", "buy"], description: "Override side (defaults: purchase docs → buy, else sell)." },
      },
      required: ["deal_id", "doc_type"],
    },
  },
  {
    name: "timber_generate_document",
    description:
      "Generate a document (PDF) for a deal, store it on the deal, and return its number and a signed download URL. Uses Timber's interim local renderer today; swaps to the Oscar generator when configured. Records an order_documents row.",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        doc_type: { type: "string", enum: DOC_TYPE_ENUM, description: "Document type to generate." },
        side: { type: "string", enum: ["sell", "buy"], description: "Override side (defaults: purchase docs → buy, else sell)." },
      },
      required: ["deal_id", "doc_type"],
    },
  },
  {
    name: "timber_set_deal_status",
    description: "Set a deal's operational fulfilment status. Validated against the status set. Timber tracks fulfilment status; the sales pipeline lives in the Oscar CRM.",
    readOnly: false,
    lifecycle: "status",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        status: { type: "string", enum: STATUS_ENUM, description: "New status." },
      },
      required: ["deal_id", "status"],
    },
  },
  {
    name: "timber_list_deals_missing_docs",
    description: "List deals that do NOT yet have a document of the given type — drives the document-chasing workflow (e.g. deals with no invoice or no CMR).",
    readOnly: true,
    lifecycle: "doc_chasing",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: { type: "string", enum: DOC_TYPE_ENUM, description: "The document type the deal should have." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
      required: ["doc_type"],
    },
  },
];
