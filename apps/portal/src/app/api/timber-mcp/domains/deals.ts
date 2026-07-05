/**
 * Timber MCP · DEALS domain — the deal / spine / lifecycle / document surface.
 *
 * Exports (aggregated by ../tools.ts + ../route.ts):
 *  - `dealTools`     — the ToolDef[] for this domain (deal read/create/line-items/
 *                      update/sourcing/margin/numbering/documents/firming/status/
 *                      doc-chasing/spine/gates).
 *  - `dealCaps`      — the per-tool USER_WRITE_CAPABILITY entries (T2).
 *  - `dealHandlers`  — the dispatch handler map: each handler is the exact body of
 *                      that tool's former `route.ts` switch case (arg validation +
 *                      arg-mapping + service call), unchanged.
 *
 * Pure code-motion from the monolithic tools.ts/route.ts — no behaviour change.
 */
import { DOC_TYPES } from "@/features/orders/services/documents/registry";
import type { DealSide, DealKind, DocType, TransportBilling, OrderExternalRef } from "@/features/orders/services/dealModel";
import {
  createDeal,
  getOrderDeal,
  listDeals,
  replaceLineItems,
  allocateDealCode,
  updateDealFields,
  setExternalRefs,
  setDealStatus,
  listDealsMissingDocs,
  startSourcing,
  setMarginApproval,
  duplicateDeal,
} from "@/features/orders/services/orderDeals";
import type { OrderDealView, OrderDealSummary } from "@/features/orders/services/orderDeals";
import {
  assembleDocumentData,
  generateDocument,
  regenerateDocument,
  deleteDocument,
  uploadSignedDocument,
  getSignedDocumentUrl,
  deleteSignedDocument,
} from "@/features/orders/services/orderDocuments";
import { getSpine, listSpineDeals, getSpineLineage } from "@/features/orders/services/spines";
import type { SpineProduct } from "@/features/orders/services/spines";
import {
  evaluateAdvance,
  advanceDeal,
  recordGateConfirmation,
  cancelDeal,
  listGateConfigs,
  setDealStage,
  upsertGateConfig,
} from "@/features/orders/services/lifecycle";
import type { GateBlock } from "@/features/orders/services/lifecycle";
// T4 · pure (db, actor) services factored out of the portal getSession actions so the
// MCP deal surface can call them directly (the portal actions keep using their own copy).
import { setDealParties } from "@/features/orders/services/dealParties";
import { uploadOrderFile, deleteOrderFile } from "@/features/orders/services/orderFiles";
import { getDealSigneeContext } from "@/features/orders/services/dealSignees";
import { parseAdvanceFromPaymentTerm } from "@/features/orders/services/paymentTerms";
import { getAccessProfile } from "@/lib/access";
import { resolveFieldAccess, projectDealView } from "@/features/orders/services/dealFields";
import type { ToolDef, ToolHandler, AuthCtx, UserCtx, UserWriteCapability } from "../types";
import { toolOk, toolErr, UUID_RE } from "../types";

// D2: doc-type enum comes from the single-source registry (not a hardcoded list).
const DOC_TYPE_ENUM = DOC_TYPES;
const STATUS_ENUM = ["draft", "pending", "confirmed", "in_progress", "shipped", "completed", "loaded", "cancelled"];

export const dealTools: ToolDef[] = [
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
      "Create a new (sell-side) deal — a bilateral trade record seeded on its own spine. Use after extracting an order from an email, voice note, or meeting transcript. Set needs_sourcing=true + source_organisation_id to AUTO-SPAWN the matching BUY (sourcing) leg on the SAME spine (supplier → the house); the created deal's upstream_deal_id then points to that spawned buy leg. Set origin_deal_id to instead create a LEG on an EXISTING deal's spine (spine-Lego): the new deal joins that deal's spine and copies its spec lines (prices blank) — chains have no fixed shape, legs are assembled manually. Returns the created deal with its generated code. Pass idempotency_key to make repeated calls safe (a repeat returns the same deal and never re-spawns).",
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
        origin_deal_id: { type: "string", description: "Spine-Lego LEG: attach this new deal as a leg on the origin deal's SPINE (the origin mints its spine now if it lacks one). The origin's spec lines are copied unless copy_lines=false — product definition + catalog links + quantities; PRICES BLANK (each leg prices itself). No fixed chain shape; parties are your explicit choice (a leg may be held with a party unset)." },
        copy_lines: { type: "boolean", description: "When origin_deal_id is set, copy the origin's spec lines onto this leg (default true; prices always left blank)." },
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
    description: "Replace ALL of a deal's own line items with the provided list. Idempotent (full replace). A deal carries only its own lines (spec §2.1); buy-side goods live on the separate buy-leg deal — upsert them by targeting that deal's id.",
    readOnly: false,
    lifecycle: "line_items",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        side: { type: "string", enum: ["sell", "buy"], description: "DEPRECATED & ignored (A5, spec §2.1): a deal has only its own lines. Retained for back-compat; the deal's own lines are always replaced." },
        items: { type: "array", description: "Line items (see timber_create_deal.line_items shape).", items: { type: "object" } },
      },
      required: ["deal_id", "items"],
    },
  },
  {
    name: "timber_update_deal",
    description: "Update a deal's header fields (deal kind, product group, currency [Draft-only], incoterms, advance %, payment terms, delivery deadline, transport billing, notes, and the G3 per-deal signee overrides). R3: setting payment_terms derives advance_% from the chosen option unless advance_pct is passed explicitly. delivery_terms is DEPRECATED (superseded by incoterms; kept only for legacy documents). Only the provided fields change. Idempotent.",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        deal_kind: { type: "string", enum: ["buy_sell", "sale_only", "purchase_only"] },
        product_group: { type: "string" },
        currency: { type: "string", description: "R7: deal currency (e.g. EUR/GBP). Writable only while the deal is Draft, and only to an active catalog currency." },
        incoterms: { type: "string" },
        incoterms_place: { type: "string" },
        advance_pct: { type: "number", description: "Advance %. Usually derived from payment_terms (R3); pass explicitly to override." },
        payment_terms: { type: "string" },
        delivery_terms: { type: "string", description: "DEPRECATED — superseded by incoterms; retained only for legacy documents." },
        delivery_deadline: { type: "string" },
        notes: { type: "string", description: "Free-text deal notes." },
        transport_billing: { type: "string", enum: ["in_price", "separate_line", "separate_invoice"] },
        seller_signee_name: { type: "string", description: "G3: per-deal override for the seller-side signatory's name on documents (defaults from the seller org's default signee at deal creation)." },
        seller_signee_role: { type: "string", description: "G3: per-deal override for the seller-side signatory's role/title." },
        buyer_signee_name: { type: "string", description: "G3: per-deal override for the buyer-side signatory's name on documents (defaults from the buyer org's default signee)." },
        buyer_signee_role: { type: "string", description: "G3: per-deal override for the buyer-side signatory's role/title." },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_set_deal_refs",
    description: "Replace a deal's external reference codes: the client refs (project / job / PO), the N3 canonical party order numbers (customer_order_no / supplier_order_no — the customer's & supplier's OWN order numbers, which render on documents and in lists), and generic 'custom' refs. Idempotent (full replace; internal idempotency markers preserved).",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal UUID." },
        refs: {
          type: "array",
          description: "External refs. Each: {ref_type: 'client_project'|'client_job'|'client_po'|'customer_order_no'|'supplier_order_no'|'custom', ref_value, label?}. Use label to set a friendly caption for 'custom' refs.",
          items: { type: "object" },
        },
      },
      required: ["deal_id", "refs"],
    },
  },
  {
    name: "timber_start_sourcing",
    description:
      "Start sourcing an EXISTING sell deal (B1, spec §9.3/§10): spawn its BUY leg on the SAME spine with the chosen supplier as seller, copying the sell deal's line items (product definition + catalog links + quantities; PRICES BLANK for Purchasing to fill on the buy leg). Returns the new buy leg's deal view. Fails with CONFLICT if the deal already has an active buy leg — to change supplier, REPLACE it: timber_cancel_deal the current buy leg, then call this again with the new supplier (deal codes are directional identities and are never re-pointed). The sell-leg activity log stays generic ('Sourcing started'); the supplier identity is recorded on the buy leg only (the customer never sees it).",
    readOnly: false,
    lifecycle: "sourcing",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "The SELL deal (order) UUID to source from." },
        supplier_organisation_id: { type: "string", description: "Supplier organisation UUID that SELLS to the house on the spawned buy leg (from the suppliers book — is_supplier or is_producer)." },
        buyer_organisation_id: { type: "string", description: "The trader that BUYS from the supplier on the spawned buy leg. Defaults to the sell deal's seller (the trader on the sell leg) but is editable — a chain's middle leg need not be bought by the sell-leg seller. Must be an active is_trader org." },
      },
      required: ["deal_id", "supplier_organisation_id"],
    },
  },
  {
    name: "timber_set_margin_approval",
    description:
      "Approve or revoke the owner margin approval on a deal (E5, spec §5.3). Sets/clears orders.margin_approved_at/by. Owner/admin-only in the portal UI; over MCP the SERVICE_ACTOR is the owner's trusted agent (isPlatformAdmin), so the approval is recorded on the owner's behalf (margin_approved_by is null — the acting portal user is the oscar-agent). Idempotent.",
    readOnly: false,
    lifecycle: "margin",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        approved: { type: "boolean", description: "true = approve the margin (stamp margin_approved_at now); false = revoke (clear it)." },
      },
      required: ["deal_id", "approved"],
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
    name: "timber_firm_order_specification",
    description:
      "Firm the deal's Quotation into the binding Order specification (D1, spec §8.2: one document in two states). Regenerates the sales_spec IN PLACE — SAME document number, re-rendered PDF (now titled ORDER SPECIFICATION), doc_state='firm', firmed_at stamped. Idempotent (re-firming re-renders + re-stamps). Pass the sales_spec document_id, or just deal_id and the newest sales_spec document on the deal is firmed. Only the sales specification has quotation/firm states (any other doc_type is rejected).",
    readOnly: false,
    lifecycle: "firming",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID. Used to resolve the sales_spec document when document_id is omitted." },
        document_id: { type: "string", description: "The sales_spec order_documents row UUID to firm. Optional — if omitted, the deal's newest sales_spec document is used." },
      },
      required: ["deal_id"],
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
      "List the configured lifecycle gates — ONE gate set per from_stage (N1: gates are KIND-AGNOSTIC, a single set applies to every deal regardless of deal kind). Each gate carries the requirement blocks (party sign-offs, buyer acceptance, required documents) that must be satisfied before a deal advances past that stage. Read-only — gates are authored in the portal admin UI (write via timber_upsert_gate_config).",
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
  // ── T4: duplicate / free stage-jump / party-set (fill a party-less draft) ──────
  {
    name: "timber_duplicate_deal",
    description:
      "Duplicate a deal (R5): create a NEW draft copying the source deal's header (parties, product group, currency, incoterms, terms, notes) and its line items, seeded on its own fresh spine. Returns the new deal with its freshly-minted code. Admin-only.",
    readOnly: false,
    lifecycle: "deal_create",
    inputSchema: {
      type: "object",
      properties: { source_deal_id: { type: "string", description: "The deal (order) UUID to duplicate." } },
      required: ["source_deal_id"],
    },
  },
  {
    name: "timber_set_deal_stage",
    description:
      "Set a deal's lifecycle stage DIRECTLY (R8 free stage-jump: draft/confirmed/produced/loaded/delivered), bypassing gate checks. A forward move that skips an unsatisfied, configured gate is recorded as a manual OVERRIDE (the bypassed requirements are logged) — use timber_advance_deal for the gated path. Rejects a no-op and a cancelled deal; guarded against a concurrent move (STAGE_CONFLICT).",
    readOnly: false,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        stage: { type: "string", enum: ["draft", "confirmed", "produced", "loaded", "delivered"], description: "Target lifecycle stage." },
      },
      required: ["deal_id", "stage"],
    },
  },
  {
    name: "timber_set_deal_parties",
    description:
      "Set the Customer (buyer) + Manufacturer (seller) on a party-less DRAFT deal (H1) — e.g. an MCP-created draft — then mint its bilateral deal code. Parties are only settable while Draft and each slot is set ONCE then locked (a change after that is cancel + recreate, §3.1). Fills only an empty slot; the customer & manufacturer must differ. Returns the (re-)minted deal code.",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID (a party-less draft)." },
        customer_organisation_id: { type: "string", description: "Customer (buyer) organisation UUID." },
        seller_organisation_id: { type: "string", description: "Manufacturer/trader (seller) organisation UUID." },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "timber_use_contact_as_signee",
    description:
      "Set a deal's per-deal signee override (G3) for one side from a CRM contact of that side's party org: copies the contact's name + role into the deal's seller/buyer signee fields that render on documents. The contact must belong to the deal's org on that side (seller = seller org; buyer = buyer org, else the customer org). Returns the updated deal.",
    readOnly: false,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        side: { type: "string", enum: ["seller", "buyer"], description: "Which signature block to set (seller side or buyer side)." },
        contact_id: { type: "string", description: "org_contacts UUID of a contact on that side's party org." },
      },
      required: ["deal_id", "side", "contact_id"],
    },
  },
  {
    name: "timber_get_deal_signee_context",
    description:
      "Read the per-side signee context for a deal (R9): for the seller side and the buyer side, the party org id + name and that org's DEFAULT signee name/role. Drives the signee picker + shows who signs when there is no per-deal override. Read-only.",
    readOnly: true,
    lifecycle: "deal_update",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "Deal (order) UUID." } },
      required: ["deal_id"],
    },
  },
  // ── T4: external files on a deal (base64 content, ≤5MB decoded) ────────────────
  {
    name: "timber_upload_deal_file",
    description:
      "Attach an external file to a deal (stored under the deal's 'deal' file category). Pass the file as base64 in `content` — the DECODED size must be ≤ 5MB (larger is rejected before upload). Returns the created file record (id, name, size).",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal (order) UUID." },
        file_name: { type: "string", description: "Original file name (with extension)." },
        content: { type: "string", description: "File bytes as base64 (a data: URL prefix is tolerated). Decoded size must be ≤ 5MB." },
        mime_type: { type: "string", description: "MIME type, e.g. 'application/pdf' (optional; inferred from the name otherwise)." },
      },
      required: ["deal_id", "file_name", "content"],
    },
  },
  {
    name: "timber_delete_deal_file",
    description: "Remove a file previously attached to a deal (deletes the storage object + the file record). Idempotent — deleting an already-gone file succeeds.",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: { file_id: { type: "string", description: "order_files UUID (from timber_upload_deal_file / timber_get_deal)." } },
      required: ["file_id"],
    },
  },
  // ── T4: N2 signed versions of a generated document + admin doc delete ──────────
  {
    name: "timber_upload_signed_document",
    description:
      "Upload (or replace) the counterparty-SIGNED version of an already-generated document (N2). Stored alongside the system-generated PDF on the same order_documents row. Pass the signed file as base64 in `content` — DECODED size must be ≤ 5MB (larger is rejected). Returns the document id + a signed download URL for the uploaded version.",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: {
        document_id: { type: "string", description: "order_documents UUID of the generated document to attach the signed version to." },
        file_name: { type: "string", description: "Signed file name (e.g. 'contract-signed.pdf')." },
        content: { type: "string", description: "Signed file bytes as base64 (a data: URL prefix is tolerated). Decoded size must be ≤ 5MB." },
        mime_type: { type: "string", description: "MIME type (default 'application/pdf')." },
      },
      required: ["document_id", "file_name", "content"],
    },
  },
  {
    name: "timber_delete_signed_document",
    description: "Delete the uploaded SIGNED version of a document (N2) — removes the signed file + clears the signed_* columns, leaving the generated document row itself intact. Idempotent.",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: { document_id: { type: "string", description: "order_documents UUID." } },
      required: ["document_id"],
    },
  },
  {
    name: "timber_get_signed_document_url",
    description: "Mint a fresh signed download URL for a document's uploaded SIGNED version (N2). Fails if no signed version has been uploaded. Read-only.",
    readOnly: true,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: { document_id: { type: "string", description: "order_documents UUID." } },
      required: ["document_id"],
    },
  },
  {
    name: "timber_delete_document",
    description: "Delete a generated document from a deal (removes the order_documents row + its storage object, including any uploaded signed version). Admin-only. Idempotent — deleting an already-gone document succeeds.",
    readOnly: false,
    lifecycle: "documents",
    inputSchema: {
      type: "object",
      properties: { document_id: { type: "string", description: "order_documents UUID to delete." } },
      required: ["document_id"],
    },
  },
  // ── T4: admin gate configuration (write side of timber_list_gate_configs) ──────
  {
    name: "timber_upsert_gate_config",
    description:
      "Create or replace the lifecycle gate for a from_stage (N1: gates are KIND-AGNOSTIC — one set per stage, applied to every deal). The gate's requirement blocks must all be satisfied before a deal advances past that stage. Admin-only. Requirement block shapes: {type:'party_signoff', party:'seller'|'buyer'}, {type:'acceptance'}, {type:'condition', condition:'document_present', docType?:<doc type>}. ('payment_recorded' has no wired source yet and is rejected.)",
    readOnly: false,
    lifecycle: "gates",
    inputSchema: {
      type: "object",
      properties: {
        from_stage: { type: "string", enum: ["draft", "confirmed", "produced", "loaded"], description: "The stage whose exit gate this configures (delivered is terminal, no gate)." },
        requirements: {
          type: "array",
          description: "The requirement blocks (all must be satisfied to advance). Each: {type:'party_signoff', party:'seller'|'buyer'} | {type:'acceptance'} | {type:'condition', condition:'document_present', docType?}.",
          items: { type: "object" },
        },
        is_active: { type: "boolean", description: "Whether the gate is active (default true). An inactive/empty gate auto-advances." },
      },
      required: ["from_stage", "requirements"],
    },
  },
];

/**
 * T2 · WRITE capabilities for this domain's write tools (deal terms, orders.view,
 * suppliers-book, and the owner-only margin approval). Merged into the aggregate
 * USER_WRITE_CAPABILITY by ../tools.ts.
 */
export const dealCaps: Record<string, UserWriteCapability> = {
  // deal_terms-editable (requireLineWriteAccess): terms, lines, refs, documents, firming
  timber_upsert_deal_line_items: "deal_terms",
  timber_update_deal: "deal_terms",
  timber_set_deal_refs: "deal_terms",
  timber_get_document_data: "deal_terms",
  timber_generate_document: "deal_terms",
  timber_firm_order_specification: "deal_terms",
  // T4 · deal_terms-editable: party-set + signee override, deal files, N2 signed versions
  timber_set_deal_parties: "deal_terms",
  timber_use_contact_as_signee: "deal_terms",
  timber_upload_deal_file: "deal_terms",
  timber_delete_deal_file: "deal_terms",
  timber_upload_signed_document: "deal_terms",
  timber_delete_signed_document: "deal_terms",
  // orders.view house user (create / status / numbering / lifecycle)
  timber_create_deal: "orders_view",
  timber_allocate_deal_code: "orders_view",
  timber_set_deal_status: "orders_view",
  timber_advance_deal: "orders_view",
  timber_cancel_deal: "orders_view",
  timber_record_gate_confirmation: "orders_view", // + service own-party check
  timber_set_deal_stage: "orders_view", // T4 · free stage-jump (mirrors the orders.view/house gate)
  // suppliers-book access
  timber_start_sourcing: "suppliers_book",
  // owner/admin-only (RLS admin-walled; service also self-checks)
  timber_set_margin_approval: "admin",
  timber_duplicate_deal: "admin", // T4 · portal duplicateDealAction is admin-only
  timber_delete_document: "admin", // T4 · deleteDocument requires isPlatformAdmin
  timber_upsert_gate_config: "admin", // T4 · upsertGateConfig requires REAL isPlatformAdmin
};

// ── T2 · deal-read field-wall projection (moved verbatim from route.ts) ────────
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

// ── Arg-mapping helpers (deals only) ──────────────────────────────────────────
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

// T4 · 5MB DECODED cap on base64 file uploads (deal files + N2 signed documents).
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Decode a base64 `content` arg into bytes and enforce the ≤5MB DECODED cap BEFORE
 * the file touches storage. Tolerates a leading `data:<type>;base64,` URL prefix.
 * Returns the bytes, or a user-facing error string if the payload is empty/oversized.
 */
function decodeUploadContent(content: unknown): { bytes: Uint8Array } | { error: string } {
  if (typeof content !== "string" || content.length === 0) return { error: "content (base64) is required" };
  const b64 = content.replace(/^data:[^;,]*;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength === 0) return { error: "content decoded to 0 bytes — not valid base64?" };
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return { error: `File too large: ${buf.byteLength} bytes decoded exceeds the 5MB cap (${MAX_UPLOAD_BYTES} bytes)` };
  }
  return { bytes: new Uint8Array(buf) };
}

/**
 * DEALS dispatch handlers — each is the exact body of the former route.ts switch
 * case for that tool (arg validation + arg-mapping + service call), unchanged.
 */
export const dealHandlers: Record<string, ToolHandler> = {
  timber_list_deals: async (args, ctx) => {
    const { db, actor } = ctx;
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
  },
  timber_get_deal: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await getOrderDeal(db, actor, args.deal_id);
    if (!res.success) return toolErr(res.error);
    // T2 · project the deal through the key owner's field wall (chain / supplier /
    // customer / margins / deal terms) — the SAME projection as the portal Deal tab.
    const data = shouldProjectReads(ctx) ? await projectDealForUser(res.data, ctx) : res.data;
    return toolOk(data);
  },
  timber_create_deal: async (args, ctx) => {
    const { db, actor } = ctx;
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
  },
  timber_upsert_deal_line_items: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    // A5 (§2.1): a deal carries only its OWN lines (always stored side='sell').
    // The `side` arg is DEPRECATED and ignored — buy-side goods live on the
    // separate buy-leg deal (upsert them by targeting that deal's id). Forcing
    // 'sell' guarantees no new side='buy' writes.
    const res = await replaceLineItems(db, actor, args.deal_id, "sell", mapLineItemArgs(args?.items));
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_allocate_deal_code: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await allocateDealCode(db, actor, args.deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_update_deal: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    // R3 · payment_terms drives advance_% (unless advance_pct is passed explicitly),
    // matching the portal terms editor — so documents render the right advance.
    const advancePct =
      args?.advance_pct !== undefined
        ? args.advance_pct
        : args?.payment_terms != null
          ? parseAdvanceFromPaymentTerm(args.payment_terms as string)
          : undefined;
    const res = await updateDealFields(db, actor, args.deal_id, {
      dealKind: args?.deal_kind as DealKind | undefined,
      productGroup: args?.product_group,
      currency: args?.currency,
      incoterms: args?.incoterms,
      incotermsPlace: args?.incoterms_place,
      advancePct,
      paymentTerms: args?.payment_terms,
      deliveryTerms: args?.delivery_terms,
      deliveryDeadline: args?.delivery_deadline,
      transportBilling: args?.transport_billing as TransportBilling | undefined,
      notes: args?.notes,
      // G3 · per-deal signee overrides (seller/buyer signature blocks on docs).
      sellerSigneeName: args?.seller_signee_name,
      sellerSigneeRole: args?.seller_signee_role,
      buyerSigneeName: args?.buyer_signee_name,
      buyerSigneeRole: args?.buyer_signee_role,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_start_sourcing: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.supplier_organisation_id) return toolErr("deal_id and supplier_organisation_id are required");
    // L1 · buyer defaults to the sell deal's seller but is editable (wrong-buyer fix).
    const res = await startSourcing(db, actor, args.deal_id, args.supplier_organisation_id, args?.buyer_organisation_id ?? null);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_margin_approval: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || typeof args?.approved !== "boolean") return toolErr("deal_id and approved (boolean) are required");
    const res = await setMarginApproval(db, actor, args.deal_id, args.approved);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_deal_refs: async (args, ctx) => {
    const { db, actor } = ctx;
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
  },
  timber_get_document_data: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
    if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
    const res = await assembleDocumentData(db, actor, {
      orderId: args.deal_id,
      docType: args.doc_type as DocType,
      side: args?.side as DealSide | undefined,
    });
    return res.success ? toolOk(res.data.data) : toolErr(res.error);
  },
  timber_generate_document: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.doc_type) return toolErr("deal_id and doc_type are required");
    if (args.side != null && args.side !== "sell" && args.side !== "buy") return toolErr("side must be 'sell' or 'buy'");
    const res = await generateDocument(db, actor, {
      orderId: args.deal_id,
      docType: args.doc_type as DocType,
      side: args?.side as DealSide | undefined,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_firm_order_specification: async (args, ctx) => {
    const { db, actor } = ctx;
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
  },
  timber_set_deal_status: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.status) return toolErr("deal_id and status are required");
    const res = await setDealStatus(db, actor, args.deal_id, args.status);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_deals_missing_docs: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.doc_type) return toolErr("doc_type is required");
    const res = await listDealsMissingDocs(db, actor, { docType: args.doc_type as DocType, limit: args?.limit });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── E7: spine reads (chain + rollup + lineage) ────────────────────────────
  timber_get_spine: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.spine_id) return toolErr("spine_id is required");
    // §6.2: the full spine/chain overview is owner-only — a non-admin user key must
    // not read cross-leg rollup. The env owner token is isPlatformAdmin=true.
    if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
    const res = await getSpine(db, actor, args.spine_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_spine_deals: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.spine_id) return toolErr("spine_id is required");
    if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
    const res = await listSpineDeals(db, actor, args.spine_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_spine_lineage: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.spine_id) return toolErr("spine_id is required");
    if (!actor.isPlatformAdmin) return toolErr("Spine overview is admin-only");
    const res = await getSpineLineage(db, actor, args.spine_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── E7: lifecycle gates (read + advance a deal's stage) ───────────────────
  timber_get_advance_status: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await evaluateAdvance(db, args.deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_gate_configs: async (_args, ctx) => {
    const { db } = ctx;
    const res = await listGateConfigs(db);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_advance_deal: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await advanceDeal(db, actor, args.deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_record_gate_confirmation: async (args, ctx) => {
    const { db, actor } = ctx;
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
  },
  timber_cancel_deal: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await cancelDeal(db, actor, args.deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── T4: duplicate / free stage-jump / party-set / signee ───────────────────
  timber_duplicate_deal: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.source_deal_id) return toolErr("source_deal_id is required");
    const res = await duplicateDeal(db, actor, args.source_deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_deal_stage: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.stage) return toolErr("deal_id and stage are required");
    const res = await setDealStage(db, actor, args.deal_id, args.stage);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_deal_parties: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    if (!args?.customer_organisation_id && !args?.seller_organisation_id) {
      return toolErr("Provide at least one of customer_organisation_id / seller_organisation_id");
    }
    const res = await setDealParties(db, actor, ctx.orgId, {
      orderId: args.deal_id,
      customerOrganisationId: args?.customer_organisation_id ?? null,
      sellerOrganisationId: args?.seller_organisation_id ?? null,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_use_contact_as_signee: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.contact_id) return toolErr("deal_id and contact_id are required");
    if (args.side !== "seller" && args.side !== "buyer") return toolErr("side must be 'seller' or 'buyer'");
    if (!UUID_RE.test(args.deal_id) || !UUID_RE.test(args.contact_id)) return toolErr("deal_id and contact_id must be UUIDs");
    // Resolve the deal's party org for the chosen side (buyer mirrors the document
    // buyer card: bilateral buyer, else the legacy customer slot).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dealRow } = await (db as any)
      .from("orders")
      .select("seller_organisation_id, customer_organisation_id, buyer_organisation_id")
      .eq("id", args.deal_id)
      .maybeSingle();
    if (!dealRow) return toolErr("Deal not found");
    const partyOrgId: string | null =
      args.side === "seller"
        ? (dealRow.seller_organisation_id ?? null)
        : (dealRow.buyer_organisation_id ?? dealRow.customer_organisation_id ?? null);
    if (!partyOrgId) return toolErr(`This deal has no ${args.side}-side party set`);
    // The contact must belong to that party org (K1 book-wall: RLS also limits which
    // contacts a user key can even read).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact } = await (db as any)
      .from("org_contacts")
      .select("id, organisation_id, name, role_title")
      .eq("id", args.contact_id)
      .maybeSingle();
    if (!contact || contact.organisation_id !== partyOrgId) {
      return toolErr("Contact not found on this deal's party org for that side");
    }
    const signeeName = (contact.name as string | null) ?? null;
    const signeeRole = (contact.role_title as string | null) ?? null;
    const patch =
      args.side === "seller"
        ? { sellerSigneeName: signeeName, sellerSigneeRole: signeeRole }
        : { buyerSigneeName: signeeName, buyerSigneeRole: signeeRole };
    const res = await updateDealFields(db, actor, args.deal_id, patch);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_deal_signee_context: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id) return toolErr("deal_id is required");
    const res = await getDealSigneeContext(db, actor, args.deal_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── T4: external files on a deal (base64 content, ≤5MB decoded) ─────────────
  timber_upload_deal_file: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.deal_id || !args?.file_name) return toolErr("deal_id and file_name are required");
    if (!UUID_RE.test(args.deal_id)) return toolErr("deal_id must be a UUID");
    const decoded = decodeUploadContent(args?.content);
    if ("error" in decoded) return toolErr(decoded.error);
    const res = await uploadOrderFile(db, actor, {
      orderId: args.deal_id,
      category: "deal",
      bytes: decoded.bytes,
      fileName: args.file_name,
      mimeType: args?.mime_type ?? null,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_deal_file: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.file_id) return toolErr("file_id is required");
    const res = await deleteOrderFile(db, actor, args.file_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── T4: N2 signed versions of a generated document + admin doc delete ──────
  timber_upload_signed_document: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.document_id || !args?.file_name) return toolErr("document_id and file_name are required");
    if (!UUID_RE.test(args.document_id)) return toolErr("document_id must be a UUID");
    const decoded = decodeUploadContent(args?.content);
    if ("error" in decoded) return toolErr(decoded.error);
    const res = await uploadSignedDocument(db, actor, {
      documentId: args.document_id,
      bytes: decoded.bytes,
      fileName: args.file_name,
      mimeType: args?.mime_type ?? "application/pdf",
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_signed_document: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.document_id) return toolErr("document_id is required");
    const res = await deleteSignedDocument(db, actor, args.document_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_signed_document_url: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.document_id) return toolErr("document_id is required");
    const res = await getSignedDocumentUrl(db, actor, args.document_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_document: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.document_id) return toolErr("document_id is required");
    const res = await deleteDocument(db, actor, args.document_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── T4: admin gate configuration (write side of timber_list_gate_configs) ──
  timber_upsert_gate_config: async (args, ctx) => {
    const { db, actor } = ctx;
    if (!args?.from_stage) return toolErr("from_stage is required");
    if (!Array.isArray(args?.requirements)) return toolErr("requirements[] is required");
    const res = await upsertGateConfig(db, actor, {
      fromStage: args.from_stage,
      requirements: args.requirements as GateBlock[],
      isActive: args?.is_active,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
};
