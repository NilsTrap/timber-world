# Timber MCP tools — authoritative list

_Generated from `apps/portal/src/app/api/timber-mcp/tools.ts` (the single source of truth) by `apps/portal/scripts/gen-mcp-tools-doc.mts`. Regenerate after adding a tool; do not hand-edit._

**40 tools** across **17 lifecycle steps** — 20 read-only, 20 writes.

Endpoint: `POST /api/timber-mcp` (JSON-RPC 2.0; Oscar Workflows contract). Auth = one bearer token of two: the **READONLY** token exposes the 20 read tools only (chat agents — prompt-injection blast-radius containment); the **FULL** token exposes all 40 (the workflow engine). Every **write** below is FULL-token only.

Each entry shows the first sentence of the tool's description; call the endpoint's `tools/list` for the full input schema.

## vocabulary (3)

- `timber_get_attribute_definitions` (read) — List the controlled-vocabulary attribute definitions (deal/line-item fields like species, quality, humidity, processing, plus the dimension fields).
- `timber_get_category_fields` (read) — List the spec fields assigned to one product category (the AI's question set for that category, per E5).
- `timber_list_attribute_options` (read) — List the allowed options (value + label) for one attribute, identified by its key (from timber_get_attribute_definitions).

## org (4)

- `timber_list_orgs` (read) — List Timber organisations (customers/manufacturers/producers) with their company card + CRM link.
- `timber_get_org` (read) — Get one Timber organisation by id — full company card (legal address, VAT/registration, country, contact, bank) + role flags + crm_org_id.
- `timber_create_org` (**write**) — Create a Timber organisation (3-char code + name + optional company card).
- `timber_update_org` (**write**) — Update an existing Timber organisation (partial — only the provided fields change).

## deal_create (1)

- `timber_create_deal` (**write**) — Create a new (sell-side) deal — a bilateral trade record seeded on its own spine.

## deal_read (2)

- `timber_list_deals` (read) — List deals (trade records), newest first.
- `timber_get_deal` (read) — Get one deal by id, including its line items, external reference codes and generated documents.

## line_items (1)

- `timber_upsert_deal_line_items` (**write**) — Replace ALL of a deal's own line items with the provided list.

## deal_update (2)

- `timber_update_deal` (**write**) — Update a deal's header fields (deal kind, product group, incoterms, advance %, payment/delivery terms + deadline, transport billing, and the G3 per-deal signee overrides for the seller/buyer signature blocks).
- `timber_set_deal_refs` (**write**) — Replace a deal's client external reference codes (project / job / PO).

## sourcing (1)

- `timber_start_sourcing` (**write**) — Start sourcing an EXISTING sell deal (B1, spec §9.3/§10): spawn its BUY leg on the SAME spine with the chosen supplier as seller, copying the sell deal's line items (product definition + catalog links + quantities; PRICES BLANK for Purchasing to fill on the buy leg).

## margin (1)

- `timber_set_margin_approval` (**write**) — Approve or revoke the owner margin approval on a deal (E5, spec §5.3).

## numbering (1)

- `timber_allocate_deal_code` (**write**) — Allocate (or return, if already set) the Timber deal code for a deal — the Nils-convention ENTITY+CLIENT+SEQ code (e.g.

## documents (2)

- `timber_get_document_data` (**write**) — Assemble the full render-ready data for a deal document (parties' company cards, line items, totals, VAT rule + reference, amount-in-words, and a freshly-allocated Timber document number).
- `timber_generate_document` (**write**) — Generate a document (PDF) for a deal, store it on the deal, and return its number and a signed download URL.

## firming (1)

- `timber_firm_order_specification` (**write**) — Firm the deal's Quotation into the binding Order specification (D1, spec §8.2: one document in two states).

## status (1)

- `timber_set_deal_status` (**write**) — Set a deal's operational fulfilment status.

## doc_chasing (1)

- `timber_list_deals_missing_docs` (read) — List deals that do NOT yet have a document of the given type — drives the document-chasing workflow (e.g.

## spine (3)

- `timber_get_spine` (read) — Get one spine (the shared product identity that a chain of bilateral deals hangs off): its code (SP-###), title, life stage (spec/lot), product group, shared product definition and rolled-up status.
- `timber_list_spine_deals` (read) — List every deal attached to a spine, oldest-first — the deal chain (e.g.
- `timber_get_spine_lineage` (read) — Get a spine's lineage both directions: the spines it was derived FROM (split/merge sources) and the spines derived from it.

## gates (5)

- `timber_get_advance_status` (read) — Read-only: can this deal advance to its next lifecycle stage (draft→confirmed→produced→loaded→delivered), and if a gate blocks it, which requirements are still unmet? Returns current stage, next stage, the gate requirements, whether satisfied, and the unmet blocks.
- `timber_list_gate_configs` (read) — List the configured lifecycle gates (per deal_kind + from_stage): the requirement blocks (party sign-offs, buyer acceptance, required documents) that must be satisfied before a deal advances past that stage.
- `timber_advance_deal` (**write**) — Advance a deal one lifecycle milestone if its gate is satisfied (or has no requirements).
- `timber_record_gate_confirmation` (**write**) — Record a party sign-off or buyer-acceptance confirmation against a deal's current-stage gate, so a gate that requires it can be satisfied.
- `timber_cancel_deal` (**write**) — Cancel a deal (sets its lifecycle stage + operational status to cancelled).

## access (7)

- `timber_list_access_groups` (read) — List the access groups (the thing that grants portal access + deal-field visibility since E4), each with its key, name, system flag and member count.
- `timber_get_access_group` (read) — Get one access group's full rights: enabled modules, deal-row visibility, deal-field domains (visible/editable), field overrides, deal scope (mine/company/all) and action grants.
- `timber_list_user_access_groups` (read) — List every access group and whether it is assigned to a given user in a given organisation.
- `timber_list_users` (read) — List portal users (id, email, name, role) — the directory for resolving a user before reading their group assignments.
- `timber_set_user_groups` (**write**) — Replace a user's access-group membership in ONE organisation (full replacement — the provided group_ids become the user's complete set of groups in that org; pass [] to remove all).
- `timber_upsert_access_group` (**write**) — Create or update an access group.
- `timber_delete_access_group` (**write**) — Delete an access group.

## catalog (4)

- `timber_list_catalog_products` (read) — List a product category's products, each with its variants and per-variant prices (EUR cents) + dimensions + stock unit.
- `timber_get_catalog_variant` (read) — Get one catalog variant's full detail: dimensions, price (EUR cents), its owning product, the packaging forms assigned to it (the ONLY forms stock may be held in), and its current stock (per-form quantities + total pieces).
- `timber_get_variant_stock` (read) — Get a catalog variant's stock: the quantity held in each packaging form + the computed total pieces.
- `timber_set_variant_stock` (**write**) — Set a catalog variant's stock quantity for ONE packaging form (create or update that line).

