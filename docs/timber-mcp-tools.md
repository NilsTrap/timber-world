# Timber MCP tools — authoritative list

_Generated from `apps/portal/src/app/api/timber-mcp/tools.ts` (the single source of truth) by `apps/portal/scripts/gen-mcp-tools-doc.mts`. Regenerate after adding a tool; do not hand-edit._

**93 tools** across **17 lifecycle steps** — 30 read-only, 63 writes.

Endpoint: `POST /api/timber-mcp` (JSON-RPC 2.0; Oscar Workflows contract). Auth = one bearer token of two: the **READONLY** token exposes the 30 read tools only (chat agents — prompt-injection blast-radius containment); the **FULL** token exposes all 93 (the workflow engine). Every **write** below is FULL-token only.

Each entry shows the first sentence of the tool's description; call the endpoint's `tools/list` for the full input schema.

## vocabulary (3)

- `timber_get_attribute_definitions` (read) — List the controlled-vocabulary attribute definitions (deal/line-item fields like species, quality, humidity, processing, plus the dimension fields).
- `timber_get_category_fields` (read) — List the spec fields assigned to one product category (the AI's question set for that category, per E5).
- `timber_list_attribute_options` (read) — List the allowed options (value + label) for one attribute, identified by its key (from timber_get_attribute_definitions).

## org (7)

- `timber_list_orgs` (read) — List Timber organisations (customers/manufacturers/producers) with their company card + CRM link.
- `timber_get_org` (read) — Get one Timber organisation by id — full company card (legal address, VAT/registration, country, contact, bank) + role flags + crm_org_id.
- `timber_create_org` (**write**) — Create a Timber organisation (3-char code + name + optional company card + role flags).
- `timber_update_org` (**write**) — Update an existing Timber organisation (partial — only the provided fields change).
- `timber_list_org_contacts` (read) — List the named contacts on a counterparty organisation (primary-first, then newest).
- `timber_upsert_org_contact` (**write**) — Create or update a contact on a counterparty organisation.
- `timber_delete_org_contact` (**write**) — Hard-delete a contact from its counterparty organisation.

## deal_create (2)

- `timber_create_deal` (**write**) — Create a new (sell-side) deal — a bilateral trade record seeded on its own spine.
- `timber_duplicate_deal` (**write**) — Duplicate a deal (R5): create a NEW draft copying the source deal's header (parties, product group, currency, incoterms, terms, notes) and its line items, seeded on its own fresh spine.

## deal_read (2)

- `timber_list_deals` (read) — List deals (trade records), newest first.
- `timber_get_deal` (read) — Get one deal by id, including its line items, external reference codes and generated documents.

## line_items (1)

- `timber_upsert_deal_line_items` (**write**) — Replace ALL of a deal's own line items with the provided list.

## deal_update (5)

- `timber_update_deal` (**write**) — Update a deal's header fields (deal kind, product group, currency [Draft-only], incoterms, advance %, payment terms, delivery deadline, transport billing, notes, and the G3 per-deal signee overrides).
- `timber_set_deal_refs` (**write**) — Replace a deal's external reference codes: the client refs (project / job / PO), the N3 canonical party order numbers (customer_order_no / supplier_order_no — the customer's & supplier's OWN order numbers, which render on documents and in lists), and generic 'custom' refs.
- `timber_set_deal_parties` (**write**) — Set the Customer (buyer) + Manufacturer (seller) on a party-less DRAFT deal (H1) — e.g.
- `timber_use_contact_as_signee` (**write**) — Set a deal's per-deal signee override (G3) for one side from a CRM contact of that side's party org: copies the contact's name + role into the deal's seller/buyer signee fields that render on documents.
- `timber_get_deal_signee_context` (read) — Read the per-side signee context for a deal (R9): for the seller side and the buyer side, the party org id + name and that org's DEFAULT signee name/role.

## sourcing (1)

- `timber_start_sourcing` (**write**) — Start sourcing an EXISTING sell deal (B1, spec §9.3/§10): spawn its BUY leg on the SAME spine with the chosen supplier as seller, copying the sell deal's line items (product definition + catalog links + quantities; PRICES BLANK for Purchasing to fill on the buy leg).

## margin (1)

- `timber_set_margin_approval` (**write**) — Approve or revoke the owner margin approval on a deal (E5, spec §5.3).

## numbering (1)

- `timber_allocate_deal_code` (**write**) — Allocate (or return, if already set) the Timber deal code for a deal — the Nils-convention ENTITY+CLIENT+SEQ code (e.g.

## documents (8)

- `timber_get_document_data` (**write**) — Assemble the full render-ready data for a deal document (parties' company cards, line items, totals, VAT rule + reference, amount-in-words, and a freshly-allocated Timber document number).
- `timber_generate_document` (**write**) — Generate a document (PDF) for a deal, store it on the deal, and return its number and a signed download URL.
- `timber_upload_deal_file` (**write**) — Attach an external file to a deal (stored under the deal's 'deal' file category).
- `timber_delete_deal_file` (**write**) — Remove a file previously attached to a deal (deletes the storage object + the file record).
- `timber_upload_signed_document` (**write**) — Upload (or replace) the counterparty-SIGNED version of an already-generated document (N2).
- `timber_delete_signed_document` (**write**) — Delete the uploaded SIGNED version of a document (N2) — removes the signed file + clears the signed_* columns, leaving the generated document row itself intact.
- `timber_get_signed_document_url` (read) — Mint a fresh signed download URL for a document's uploaded SIGNED version (N2).
- `timber_delete_document` (**write**) — Delete a generated document from a deal (removes the order_documents row + its storage object, including any uploaded signed version).

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

## gates (7)

- `timber_get_advance_status` (read) — Read-only: can this deal advance to its next lifecycle stage (draft→confirmed→produced→loaded→delivered), and if a gate blocks it, which requirements are still unmet? Returns current stage, next stage, the gate requirements, whether satisfied, and the unmet blocks.
- `timber_list_gate_configs` (read) — List the configured lifecycle gates — ONE gate set per from_stage (N1: gates are KIND-AGNOSTIC, a single set applies to every deal regardless of deal kind).
- `timber_advance_deal` (**write**) — Advance a deal one lifecycle milestone if its gate is satisfied (or has no requirements).
- `timber_record_gate_confirmation` (**write**) — Record a party sign-off or buyer-acceptance confirmation against a deal's current-stage gate, so a gate that requires it can be satisfied.
- `timber_cancel_deal` (**write**) — Cancel a deal (sets its lifecycle stage + operational status to cancelled).
- `timber_set_deal_stage` (**write**) — Set a deal's lifecycle stage DIRECTLY (R8 free stage-jump: draft/confirmed/produced/loaded/delivered), bypassing gate checks.
- `timber_upsert_gate_config` (**write**) — Create or replace the lifecycle gate for a from_stage (N1: gates are KIND-AGNOSTIC — one set per stage, applied to every deal).

## access (17)

- `timber_list_access_groups` (read) — List the access groups (the thing that grants portal access + deal-field visibility since E4), each with its key, name, system flag and member count.
- `timber_get_access_group` (read) — Get one access group's full rights: enabled modules, deal-row visibility, deal-field domains (visible/editable), field overrides, deal scope (mine/company/all) and action grants.
- `timber_list_user_access_groups` (read) — List every access group and whether it is assigned to a given user in a given organisation.
- `timber_list_users` (read) — List portal users (id, email, name, role) — the directory for resolving a user before reading their group assignments.
- `timber_set_user_groups` (**write**) — Replace a user's access-group membership in ONE organisation (full replacement — the provided group_ids become the user's complete set of groups in that org; pass [] to remove all).
- `timber_upsert_access_group` (**write**) — Create or update an access group.
- `timber_delete_access_group` (**write**) — Delete an access group.
- `timber_get_people_directory` (read) — The person-centric People directory: every portal user once, with all their organisations (primary flagged) and access groups per org.
- `timber_get_person` (read) — Get one person by portal-user id — profile (name/email/phone/role/status/active), their organisation memberships (primary flagged) and access groups per org.
- `timber_create_person` (**write**) — Create a new person (portal user) under an organisation (role=user, status=created, no credentials yet).
- `timber_add_person_to_org` (**write**) — Add an EXISTING person to an organisation (reactivates an inactive membership if present) and assigns their access groups inline.
- `timber_remove_person_from_org` (**write**) — Remove a person from an organisation: deactivates the membership and strips their access groups there.
- `timber_update_person` (**write**) — Update a person's PROFILE fields — name (required), and optionally email (globally unique) and phone.
- `timber_toggle_person_active` (**write**) — Activate or deactivate a person (is_active — a person-level flag; deactivated users cannot log in).
- `timber_resend_person_invite` (**write**) — Resend the invite email to a person in 'invited' status who already has an auth identity (rotates their pending auth user and re-sends a magic link to set their password).
- `timber_get_platform_setting` (read) — Read one platform setting (platform_settings key/value store, e.g.
- `timber_set_platform_setting` (**write**) — Set (upsert) one platform setting.

## catalog (32)

- `timber_list_catalog_products` (read) — List a product category's products, each with its variants and per-variant prices (EUR cents) + dimensions + stock unit.
- `timber_get_catalog_variant` (read) — Get one catalog variant's full detail: dimensions, price (EUR cents), its owning product, the packaging forms assigned to it (the ONLY forms stock may be held in), and its current stock (per-form quantities + total pieces).
- `timber_get_variant_stock` (read) — Get a catalog variant's stock: the quantity held in each packaging form + the computed total pieces.
- `timber_set_variant_stock` (**write**) — Set a catalog variant's stock quantity for ONE packaging form (create or update that line).
- `timber_delete_variant_stock` (**write**) — Delete ONE catalog variant stock line by its stock-entry id (catalog_variant_stock.id — from timber_get_variant_stock[].id).
- `timber_list_categories` (read) — List all catalog categories: id, slug, name, primary unit, default EUR price (cents), commission %s, active + per-surface visibility (agents/internal/marketing), sort order, and field/product counts.
- `timber_get_category` (read) — Get one catalog category by category_id (UUID) or category_slug, with its field + product counts.
- `timber_save_category` (**write**) — Create (omit id) or update (pass id) a catalog category.
- `timber_duplicate_category` (**write**) — Duplicate a category (slug '-copy', name '(Copy)', created inactive) including its field assignments.
- `timber_delete_category` (**write**) — DESTRUCTIVE — delete a category AND cascade-delete every product + variant in it (variant field values, images, stock, packaging cascade too).
- `timber_save_field` (**write**) — Create (omit id) or update (pass id) a GLOBAL catalog field (attribute).
- `timber_delete_field` (**write**) — Delete a global catalog field by id.
- `timber_save_field_option` (**write**) — Create (omit id) or update (pass id) a select-field option (value + label).
- `timber_delete_field_option` (**write**) — Delete a field option by id.
- `timber_save_field_assignment` (**write**) — Assign a global field to a category (create; omit id) or update its per-category settings (pass id): applies_to ('product' | 'variant'), the R6 show flags (show_in_filter / show_in_detail / show_in_price_list), is_required, sort_order.
- `timber_remove_field_assignment` (**write**) — Remove a field-to-category assignment by its assignment id.
- `timber_save_product` (**write**) — Create (omit id) or update (pass id) a catalog product.
- `timber_duplicate_product` (**write**) — Duplicate a product (slug '-copy', name '(Copy)', created inactive) including its field values AND all variants (with their field values).
- `timber_delete_product` (**write**) — Delete a product by id.
- `timber_bulk_product_action` (**write**) — Apply ONE batched action to many products.
- `timber_save_variant` (**write**) — Create (omit id) or update (pass id) a product variant: dimensions (thickness/width/length + min/max length in mm), price_eur_cents, stock_unit ('piece' | 'package'), sku, active, sort order.
- `timber_delete_variant` (**write**) — Delete a variant by id (its stock, images, field values, packaging assignments cascade).
- `timber_save_packaging_type` (**write**) — Create (omit id) or update (pass id) a GLOBAL packaging type (name + pieces_per_package).
- `timber_delete_packaging_type` (**write**) — Delete a global packaging type by id.
- `timber_assign_variant_packaging` (**write**) — Assign a packaging form to a variant (or update its price override / default).
- `timber_remove_variant_packaging` (**write**) — Remove a variant↔packaging assignment by its assignment id.
- `timber_list_currencies` (read) — List catalog currencies: code, name, symbol, is_base, exchange_rate + source + fetched-at, rounding rule, active, sort order.
- `timber_get_catalog_currency_prices` (read) — Get the stored derived-currency prices for a set of catalog entities (categories/products/variants).
- `timber_save_currency` (**write**) — Create or update (upsert by code) a catalog currency: code (e.g.
- `timber_delete_currency` (**write**) — Delete a catalog currency by code.
- `timber_update_currency_prices` (**write**) — Fetch the latest ECB EUR→code daily reference rate, store it on the currency, then recompute + replace every AUTO (non-manual) derived price for that currency across categories/products/variants (manual overrides preserved).
- `timber_set_variant_currency_override` (**write**) — Hand-set (or clear) a variant's price in a derived currency.

