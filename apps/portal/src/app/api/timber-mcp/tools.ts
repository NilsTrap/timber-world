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
  "deal_create",  // create a deal from intake (+ auto-spawn the buy leg — E7)
  "deal_read",    // list/get deals
  "line_items",   // set the deal's line items
  "deal_update",  // amend deal fields / external refs
  "numbering",    // allocate Timber deal/document numbers
  "documents",    // assemble + generate/store documents
  "status",       // operational fulfilment status transitions
  "doc_chasing",  // find deals missing required documents
  "spine",        // query the spine: chain of deals + rolled-up status + lineage (E7)
  "gates",        // read + advance a deal's lifecycle stage through its gates (E7)
  "access",       // read the access-group / user management surface (E7)
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
    name: "timber_get_category_fields",
    description:
      "List the spec fields assigned to one product category (the AI's question set for that category, per E5). Identify the category by category_id (UUID) or category_slug (e.g. 'firewood', 'boards', 'stairs', 'solid-wood-panels'). Returns each field ordered, with key, label, type, unit, whether it applies to the product or variant, whether it is required, and its active select options. Use before creating a deal in a category to know exactly which attributes to ask about.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "Category UUID (from the catalog). Provide this OR category_slug." },
        category_slug: { type: "string", description: "Category slug, e.g. 'firewood', 'boards', 'stairs', 'solid-wood-panels'. Resolved to the category id." },
      },
    },
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
      "Create a new (sell-side) deal — a bilateral trade record seeded on its own spine. Use after extracting an order from an email, voice note, or meeting transcript. Set needs_sourcing=true + source_organisation_id to AUTO-SPAWN the matching BUY (sourcing) leg on the SAME spine (supplier → the house); the created deal's upstream_deal_id then points to that spawned buy leg. Returns the created deal with its generated code. Pass idempotency_key to make repeated calls safe (a repeat returns the same deal and never re-spawns).",
    readOnly: false,
    lifecycle: "deal_create",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short deal name/label (defaults to the customer or product group if omitted)." },
        product_group: { type: "string", description: "Product group, e.g. 'malka', 'boards'." },
        currency: { type: "string", enum: ["EUR", "GBP", "USD"], description: "Deal currency (default EUR)." },
        customer_name: { type: "string", description: "Buyer name (used for the deal code when no org row exists)." },
        customer_organisation_id: { type: "string", description: "Buyer organisation UUID, if known (legacy customer slot; mirrors buyer)." },
        buyer_organisation_id: { type: "string", description: "Buyer organisation UUID (canonical bilateral buyer; defaults to customer_organisation_id)." },
        seller_organisation_id: { type: "string", description: "Selling/trading entity organisation UUID (defaults to Timber International)." },
        producer_organisation_id: { type: "string", description: "Producer organisation UUID (finishing subcontractor), if known." },
        needs_sourcing: { type: "boolean", description: "Auto-spawn the matching BUY (sourcing) deal on the same spine (a sale that must be sourced from a supplier). Requires source_organisation_id." },
        source_organisation_id: { type: "string", description: "Supplier organisation UUID that SELLS to the house on the auto-spawned buy leg. Used only when needs_sourcing is true." },
        spine_product: {
          type: "object",
          description: "Optional shared product definition for the deal's spine, applied when a new spine is seeded. Use snake_case keys.",
          properties: {
            wood_species: { type: "string" },
            product_type: { type: "string" },
            processing: { type: "string", description: "Finish/processing." },
            quality: { type: "string" },
            certificate: { type: "string" },
            thickness: { type: "string" },
            width: { type: "string" },
            length: { type: "string" },
            pieces: { type: "string" },
            volume_m3: { type: "number" },
          },
        },
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
  // ── E7: spine (chain + rollup + lineage) ───────────────────────────────────
  {
    name: "timber_get_spine",
    description:
      "Get one spine (the shared product identity that a chain of bilateral deals hangs off): its code (SP-###), title, life stage (spec/lot), product group, shared product definition and rolled-up status. Get a spine_id from a deal (timber_get_deal → spine_id).",
    readOnly: true,
    lifecycle: "spine",
    inputSchema: {
      type: "object",
      properties: { spine_id: { type: "string", description: "Spine UUID (from a deal's spine_id)." } },
      required: ["spine_id"],
    },
  },
  {
    name: "timber_list_spine_deals",
    description:
      "List every deal attached to a spine, oldest-first — the deal chain (e.g. the sell leg + its auto-spawned buy leg) with each deal's code, name, status, seller and buyer. Use to see the whole chain and its per-deal fulfilment status.",
    readOnly: true,
    lifecycle: "spine",
    inputSchema: {
      type: "object",
      properties: { spine_id: { type: "string", description: "Spine UUID." } },
      required: ["spine_id"],
    },
  },
  {
    name: "timber_get_spine_lineage",
    description:
      "Get a spine's lineage both directions: the spines it was derived FROM (split/merge sources) and the spines derived from it. Use to trace how a lot was split or where merged material came from.",
    readOnly: true,
    lifecycle: "spine",
    inputSchema: {
      type: "object",
      properties: { spine_id: { type: "string", description: "Spine UUID." } },
      required: ["spine_id"],
    },
  },
  // ── E7: lifecycle gates (read + advance a deal's stage) ─────────────────────
  {
    name: "timber_get_advance_status",
    description:
      "Read-only: can this deal advance to its next lifecycle stage (draft→confirmed→produced→loaded→delivered), and if a gate blocks it, which requirements are still unmet? Returns current stage, next stage, the gate requirements, whether satisfied, and the unmet blocks. Call before timber_advance_deal.",
    readOnly: true,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal (order) UUID." } },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_list_gate_configs",
    description:
      "List the configured lifecycle gates (per deal_kind + from_stage): the requirement blocks (party sign-offs, buyer acceptance, required documents) that must be satisfied before a deal advances past that stage. Read-only — gates are authored in the portal admin UI.",
    readOnly: true,
    lifecycle: "gates",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_advance_deal",
    description:
      "Advance a deal one lifecycle milestone if its gate is satisfied (or has no requirements). Fails with the unmet requirements if the gate blocks it, or if the deal is already at a terminal stage. The spine's rolled-up stage is maintained automatically. Safe under retry: a stale/duplicate call that finds the deal already moved returns a STAGE_CONFLICT rather than double-advancing.",
    readOnly: false,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal (order) UUID." } },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_record_gate_confirmation",
    description:
      "Record a party sign-off or buyer-acceptance confirmation against a deal's current-stage gate, so a gate that requires it can be satisfied. Idempotent (upsert on deal+stage+block). Use block_type 'party_signoff' with block_key 'seller'|'buyer', or block_type 'acceptance'. confirmed_by_org is the confirming party's org.",
    readOnly: false,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        from_stage: { type: "string", enum: ["draft", "confirmed", "produced", "loaded"], description: "The stage whose gate this confirmation is for (the deal's current stage)." },
        block_type: { type: "string", enum: ["party_signoff", "acceptance"], description: "'party_signoff' (a party approves) or 'acceptance' (buyer accepts)." },
        block_key: { type: "string", description: "For party_signoff: 'seller' or 'buyer'. For acceptance: a label such as 'buyer'." },
        confirmed_by_org: { type: "string", description: "Organisation UUID recording the confirmation (the party it is for)." },
      },
      required: ["deal_id", "from_stage", "block_type", "block_key"],
    },
  },
  {
    name: "timber_cancel_deal",
    description:
      "Cancel a deal (sets its lifecycle stage + operational status to cancelled). If the deal was still active (≤ loaded) its spine and downstream deals are flagged chain-broken. Idempotent: cancelling an already-cancelled deal succeeds; a delivered deal cannot be cancelled.",
    readOnly: false,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal (order) UUID." } },
      required: ["deal_id"],
    },
  },
  // ── E7: user / access-group management (read surface) ───────────────────────
  {
    name: "timber_list_access_groups",
    description:
      "List the access groups (the thing that grants portal access + deal-field visibility since E4), each with its key, name, system flag and member count. Read-only — group rights are edited in the portal admin UI.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_access_group",
    description:
      "Get one access group's full rights: enabled modules, deal-row visibility, deal-field domains (visible/editable), field overrides, deal scope (mine/company/all) and action grants.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: { group_id: { type: "string", description: "Access group UUID (from timber_list_access_groups)." } },
      required: ["group_id"],
    },
  },
  {
    name: "timber_list_user_access_groups",
    description:
      "List every access group and whether it is assigned to a given user in a given organisation. Use to inspect a user's effective group membership for one org.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID (from timber_list_users)." },
        organisation_id: { type: "string", description: "Organisation UUID the assignment is scoped to." },
      },
      required: ["user_id", "organisation_id"],
    },
  },
  {
    name: "timber_list_users",
    description:
      "List portal users (id, email, name, role) — the directory for resolving a user before reading their group assignments. Optional substring query on name/email and an optional org filter (active members of that organisation).",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by name or email (substring)." },
        org_id: { type: "string", description: "Restrict to active members of this organisation UUID." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
];
