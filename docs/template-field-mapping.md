# Template placeholder → data-source audit (Epic G1)

_Dated 2026-07-03. Deliverable for **Epic G1** (spec §8 — Documents / merge fields)._

This document walks **every merge-field token the document templates can place** and maps each to
(a) its data source (a real DB column, a value computed in `assemble.ts`, or a hardcoded constant),
(b) where a house user edits that source in the portal today (or `NONE`), and
(c) a status. It is the input for the Epic G subtasks **G2** (deal-terms editor), **G3** (signee),
**G4** (counterparty form), **G5** (orphan/unused sweep). Every row resolves to a definite source —
there are **no `unknown` rows**.

**Authoritative token list:** `apps/portal/src/features/documents/compiler/registry.ts`
(`MERGE_FIELD_GROUPS` lines 27–91, `LINE_ITEM_COLUMNS` lines 108–117).
**Render shapes:** `apps/portal/src/features/orders/services/documents/types.ts`.
**Population logic:** `apps/portal/src/features/orders/services/documents/assemble.ts` (pure) +
`apps/portal/src/features/orders/services/orderDocuments.ts` (DB-bound, party cards).

Status legend: **OK** = correct source + edit UI (or correctly system-computed, no edit needed) ·
**no-UI** = has a DB column but no portal edit surface · **no-column** = no backing column anywhere ·
**hardcoded** = value fixed in code · **orphan** = token renders empty with no data home.

---

## Document group (6 tokens)

`MERGE_FIELD_GROUPS[Document]` — registry.ts:29–37.

| Token | Data source | Edit UI (portal) | Status |
|---|---|---|---|
| `docTitle` | **Hardcoded** — `DOC_TITLES[docType]` (types.ts:72–80; set in assemble.ts:99) | NONE (system, derived from the chosen doc type) | hardcoded |
| `docNumber` | **Computed** — `buildDocNumber(...)` after `allocateCounter` (orderDocuments.ts:131–135) | NONE (Timber owns numbering; system-allocated) | OK |
| `fmtDate docDate` | **Computed** — `docDate = new Date().toISOString()` at generation (orderDocuments.ts:127) | NONE (generation timestamp) | OK |
| `dealCode` | `orders.deal_code`, falls back to `orders.code` (orderDeals.ts:85–86; `deal.dealCode \|\| deal.code` assemble input at orderDocuments.ts:142) | NONE (system-assigned; `code` = `ORD-###` always exists → never empty) | OK |
| `currency` | `orders.currency` (default `'EUR'`; deals_mvp.sql / orders_universal.sql) | **NONE in the portal.** `createOrder`/`updateOrder` actions accept it (createOrder.ts:141, updateOrder.ts:166–167) but `OrderForm.tsx` exposes only customer / name / projectNumber — no currency field. Set via MCP `timber_create_deal` (tools.ts:161) or defaults to EUR. | no-UI |
| `notes` | `orders.notes` | **NONE.** Accepted by `createOrder`/`updateOrder` actions (updateOrder.ts:168) but not exposed in `OrderForm.tsx`; `DealPanel` shows it read-only (DealPanel.tsx:228). Written via MCP `timber_create_deal`/`timber_update_deal` (tools.ts:191). | no-UI |

---

## Seller group (10 tokens)

`MERGE_FIELD_GROUPS[Seller]` — registry.ts:41–52. All resolve through `fetchPartyCard()`
(orderDocuments.ts:67–96) from the **seller org's `organisations` row** (the house / Manufacturer,
`deal.seller.id`). Every column has an input in the shared **Organisation form**
(`OrganisationForm.tsx` `CARD_FIELDS` lines 67–78 + name field line 198).

| Token | Data source (`organisations` column, via `pick()` fallbacks) | Edit UI (portal) | Status |
|---|---|---|---|
| `seller.name` | `organisations.name` (orderDocuments.ts:85) | Organisations → Organisation form, "Name" (required) | OK |
| `seller.regNo` | `registration_number` (fallbacks `reg_no`/`company_number`/`reg_nr`) (orderDocuments.ts:86) | Organisation form → "Registration number" | OK |
| `seller.vatNo` | `vat_number` (fallbacks `vat_no`/`vat`) (orderDocuments.ts:87) | Organisation form → "VAT number" | OK |
| `seller.address` | **Assembled** from `legal_address` + `postal_code` + `city` + `country`, joined (orderDocuments.ts:78–88) | Organisation form → "Legal address" (single free-text field holds the whole address; no separate postcode/city inputs, but none needed) | OK |
| `seller.country` | `country` (fallback `country_code`) (orderDocuments.ts:89) — **also drives VAT** | Organisation form → "Country (ISO-2)" | OK |
| `seller.email` | `email` (fallback `contact_person_email`) (orderDocuments.ts:90) | Organisation form → "Email" | OK |
| `seller.phone` | `phone` (fallback `contact_person_phone`) (orderDocuments.ts:91) | Organisation form → "Phone" | OK |
| `seller.bankName` | `bank_name` (fallback `bank`) (orderDocuments.ts:92) | Organisation form → "Bank name" | OK |
| `seller.bankAccount` | `bank_account_number` (fallbacks `iban`/`account_number`) (orderDocuments.ts:93) | Organisation form → "Bank account / IBAN" | OK |
| `seller.bankSwift` | `bank_swift_code` (fallbacks `swift_code`/`swift`/`bic`) (orderDocuments.ts:94) | Organisation form → "SWIFT / BIC" | OK |

---

## Buyer group (10 tokens)

`MERGE_FIELD_GROUPS[Buyer]` — registry.ts:56–67. Identical plumbing to Seller, but resolved from the
**counterparty org** (`deal.buyer.id`/`deal.customer.id`, or the producer on buy legs — orderDocuments.ts:121–124).
Same `organisations` columns, same `OrganisationForm.tsx` inputs.

| Token | Data source (`organisations` column) | Edit UI (portal) | Status |
|---|---|---|---|
| `buyer.name` | `organisations.name` | Organisation form → "Name" | OK |
| `buyer.regNo` | `registration_number` | Organisation form → "Registration number" | OK |
| `buyer.vatNo` | `vat_number` | Organisation form → "VAT number" | OK |
| `buyer.address` | assembled from `legal_address` + `postal_code` + `city` + `country` | Organisation form → "Legal address" | OK |
| `buyer.country` | `country` — **also drives VAT** | Organisation form → "Country (ISO-2)" | OK |
| `buyer.email` | `email` | Organisation form → "Email" | OK |
| `buyer.phone` | `phone` | Organisation form → "Phone" | OK |
| `buyer.bankName` | `bank_name` | Organisation form → "Bank name" | OK |
| `buyer.bankAccount` | `bank_account_number` | Organisation form → "Bank account / IBAN" | OK |
| `buyer.bankSwift` | `bank_swift_code` | Organisation form → "SWIFT / BIC" | OK |

> **G4 note:** the party-card *columns* and *inputs* already exist (`OrganisationForm.tsx`), so no token
> here is `no-column`. G4's job is to make the **counterparty** org reliably reachable/editable through
> that same form (or a dedicated counterparty editor) from the deal context — not to add missing fields.

---

## Terms group (5 tokens)

`MERGE_FIELD_GROUPS[Terms]` — registry.ts:71–77. All are **`orders` columns**, added in
`orders_universal.sql:17–22` (originally `deals_mvp.sql:53–58). They are **MCP-write-only** — set via
`timber_create_deal` / `timber_update_deal` (tools.ts:185–191, 227–232) — and rendered **read-only** in
`DealPanel.tsx:186–196`. The portal-editable order-field whitelist `ORDER_FIELD_DOMAINS`
(dealFields.ts:40–110) contains **none** of them, and no order action writes them. → **G2 builds the editor.**

| Token | Data source | Edit UI (portal) | Status |
|---|---|---|---|
| `incoterms` | `orders.incoterms` (+ `orders.incoterms_place` appended in assemble.ts:109) | NONE — MCP `timber_update_deal` only; read-only in DealPanel | no-UI |
| `paymentTerms` | `orders.payment_terms` | NONE — MCP only | no-UI |
| `deliveryTerms` | `orders.delivery_terms` | NONE — MCP only | no-UI |
| `deliveryDeadline` | `orders.delivery_deadline` (free-text, e.g. "July 2026") | NONE — MCP only | no-UI |
| `pct advancePct` | `orders.advance_pct` (`NUMERIC(5,2)`) | NONE — MCP only; read-only in DealPanel | no-UI |

> **Hidden sibling:** `orders.incoterms_place` has no token of its own — it is folded into the `incoterms`
> token by assemble.ts:109. The G2 editor must expose `incoterms_place` alongside `incoterms`.

---

## Totals group (7 tokens)

`MERGE_FIELD_GROUPS[Totals]` — registry.ts:81–89. **Every totals token is computed** inside
`buildDocumentData` (assemble.ts:90–123) from the (editable) line items + the VAT engine. None is a stored
column; none needs an edit UI — they are correct by construction. The line items they derive from are
editable via the Deal panel (`LineItemsTable` / `DealLineAdder` / catalog picker).

| Token | Data source (computed in assemble.ts) | Edit UI | Status |
|---|---|---|---|
| `fmtM3 totals.totalVolumeM3` | Σ line `volumeM3` (assemble.ts:91) | via line items (DealPanel) | OK |
| `money totals.subtotalCents` | Σ line `lineTotalCents` (assemble.ts:90) | via line items (DealPanel) | OK |
| `pct totals.vatRate` | `resolveVat(seller.country, buyer.country).rate` (assemble.ts:93 → :118) | none (derived from party countries) | OK |
| `money totals.vatCents` | `round(subtotal × rate / 100)` (assemble.ts:94) | none (derived) | OK |
| `money totals.totalCents` | `subtotal + vat` (assemble.ts:95) | none (derived) | OK |
| `moneyCur totals.totalCents` | same value, currency-formatted | none (derived) | OK |
| `totals.amountInWords` | `amountInWords(totalCents, currency)` (assemble.ts:122) | none (derived) | OK |

### Totals & VAT — exact provenance (with proof)

- **`vatRate`** — **NOT a stored order column and NOT a single hardcoded constant.** It is **computed** in
  `assemble.ts:118` as `vat.rate`, where
  `const vat = resolveVat({ fromCountry: input.seller.country, toCountry: input.buyer.country })`
  (**assemble.ts:93**). `resolveVat` (**`apps/portal/src/features/orders/services/vat.ts:25–49`**) derives
  the rate from the two parties' ISO-2 country codes by route:
  LV→LV = `0` (domestic reverse charge, vat.ts:31–37); GB→GB = `20`, LV→LV-standard = `21`
  (from the rate table `DOMESTIC_STANDARD_RATE = { GB: 20, LV: 21 }`, vat.ts:16); intra-EU = `0`
  (vat.ts:45–47); export = `0` (vat.ts:48); missing country = `0`/`unknown` (vat.ts:28). So the rate is a
  **dynamic function of `organisations.country` for both parties**; the only constants are the small rate
  table and the EU-country set in `vat.ts`. → Because it flows from `seller.country` / `buyer.country`, the
  VAT rate is only correct when **both** parties' `country` fields are filled (Organisation form).

- **`vatReference`** — **computed** in `assemble.ts:119` as `vat.reference` (the legal clause, e.g.
  _"Reverse charge — domestic timber supply…"_, _"Intra-Community supply, Art. 138…"_, _"Export of goods,
  Art. 146…"_). Those reference **strings are hardcoded constants** in `vat.ts:33–48`, **selected by route**.
  It is stored on the render shape at `DocTotals.vatReference` (**types.ts:38**) — **but there is NO
  merge-field token for it** in `MERGE_FIELD_GROUPS`. It is therefore **assembled but never placed** by any
  template: the legal VAT basis is computed and thrown away. (Inverse of an orphan token: data with no token.)
  → **G5 candidate:** either add a `totals.vatReference` token (recommended — VAT-compliance text) or drop
  the unused field.

---

## Line-item columns (8 tokens)

`LINE_ITEM_COLUMNS` — registry.ts:108–117. Item-scoped cells resolved inside `{{#each lineItems}}` from
`DocLineItem` (types.ts:23–32), assembled by `toDocLine()` (assemble.ts:33–46) from each `orders`
line-item. Amounts are editable in the Deal panel (`LineItemsTable`, DealPanel.tsx:482+); descriptive
fields come from the catalog / custom line at capture.

| Token (cell) | Data source (`DocLineItem` field ← order line) | Edit UI | Status |
|---|---|---|---|
| `lineNo` | `li.lineNo` (assemble.ts:37) | auto-numbered | OK |
| `description` | assembled: product, species, processing, quality, grade note (assemble.ts:34) | catalog / custom line (DealLineAdder) | OK |
| `dimensions` | assembled `T × W × L` from thickness/width/length (assemble.ts:35) | catalog / custom line | OK |
| `pieces` | `li.pieces` | DealPanel amounts editor | OK |
| `volumeM3` | `li.volumeM3` (`fmtM3`) | DealPanel amounts editor | OK |
| `unit` | `li.unit` | catalog / custom line | OK |
| `unitPriceCents` | `li.unitPriceCents` (`money`) | DealPanel amounts editor (admin/terms-editor) | OK |
| `lineTotalCents` | `lineTotalCents(li)` — explicit or price × qty (assemble.ts:19–30) | DealPanel amounts editor | OK |

---

## The 7 seeded templates — which tokens each actually uses

Source of truth for what ships in the DB: **`supabase/migrations/20260703120000_reseed_templates_plate.sql`**
(re-seeds the default row per `doc_type` as Plate/wysiwyg; supersedes the earlier Handlebars seeds). The
"New from starter" builders in `compiler/starters/index.ts` mirror these but are **not** the seeded rows.

| doc_type | Party framing | Line-item columns | Terms shown | Totals shown | Notable |
|---|---|---|---|---|---|
| `sales_spec` | Seller / Buyer (seller w/ bank) | FULL (7 cols, incl. price+total) | incoterms, payment, delivery, deadline | volume, subtotal, vatRate, vatCents, totalCents | no amountInWords |
| `purchase_spec` | Buyer / Supplier (buyer w/ bank) | FULL | incoterms, payment, delivery, deadline | volume, subtotal, vatRate, vatCents, totalCents | no amountInWords |
| `contract` | Seller / Buyer (seller w/ bank) | FULL | payment, incoterms, delivery, deadline | subtotal, vatRate, vatCents, totalCents, **amountInWords** | clause layout + signatures |
| `proforma_invoice` | Supplier / Bill-to | FULL | payment (in payment-details callout) | subtotal, vatRate, vatCents, totalCents, **amountInWords** | seller bank in callout; no incoterms/delivery |
| `invoice` | Supplier / Bill-to | FULL | payment (in callout) | subtotal, vatRate, vatCents, totalCents, **amountInWords** | seller bank in callout; no incoterms/delivery |
| `packing_list` | Shipper / Consignee | NO_PRICES (5 cols) | incoterms, payment, delivery, deadline | volume, subtotal, vatRate, vatCents, totalCents | no prices in table but still prints totals |
| `cmr` | Sender / Consignee (+Carrier sig) | CMR (4 cols) | incoterms, payment, delivery, deadline | volume, subtotal, vatRate, vatCents, totalCents | no prices in table but still prints totals |

**Registry tokens that NO seeded template uses** (present in the palette / column designer for custom
templates, populated, but unreferenced by all 7 defaults):

- **`pct advancePct`** (Terms) — no seeded template prints it (the seeded Terms blocks stop at the deadline).
  Only the `compiler/starters/index.ts` starter includes it. It has a column (`orders.advance_pct`) but no
  portal UI → picked up by **G2**.
- **`seller.country` / `buyer.country`** (Seller/Buyer) — populated (`organisations.country`) and editable,
  and they silently drive VAT, but no seeded template renders the country line.
- **`unit`** line-item column — defined in `LINE_ITEM_COLUMNS`, populated, but no seeded column set
  (FULL / NO_PRICES / CMR) includes it.

**Real-world empty-render risk in the seeded templates** (tokens present in the 7 defaults that render blank
until data is supplied — G5 impact):

- **Terms block** (`incoterms`, `paymentTerms`, `deliveryTerms`, `deliveryDeadline`) — printed by
  sales_spec / purchase_spec / packing_list / cmr; payment also by contract / proforma / invoice. Each is
  wrapped in hide-when-empty, so today they simply **vanish** on every generated document because there is
  no portal way to set them (→ G2 fixes the blank-terms problem).
- **Seller/Buyer bank + contact rows** — hide-when-empty; blank unless the org's company card is filled
  (Organisation form exists, so this is a data-entry prompt, not a code gap).
- **`totals.amountInWords`** (contract / proforma / invoice) — computed, always populated → not at risk.
- **VAT rate/amount** — computed; renders `0%` whenever either party's `country` is blank (the `unknown`
  route), which is silent and easy to miss (see VAT note above).

---

## Findings → G-subtask routing

**Counts:** 46 tokens total (Document 6 · Seller 10 · Buyer 10 · Terms 5 · Totals 7 · Line-item 8) —
**OK 38 · no-UI 7 · hardcoded 1 · no-column 0 · orphan 0.**

**G2 — deal-terms editor** (add a portal editor for the `orders` term columns; today MCP-write-only):
- `incoterms` (+ `orders.incoterms_place`, which has no token but must be editable)
- `paymentTerms`
- `deliveryTerms`
- `deliveryDeadline`
- `pct advancePct`
- `notes` (Document group — MCP-write-only, no UI; belongs with the terms editor)
- `currency` (Document group — no portal field today; defaults EUR / MCP-set. Lower priority: never renders
  empty, but currently un-editable in the portal, so fold a currency picker into the same editor.)

**G3 — signee** (build from scratch — no token, no column, no UI anywhere):
- There is **no `signee` merge field** in the registry (confirmed: zero matches for "signee" in
  `apps/portal/src` and the migrations) and **no backing column**. The seeded templates render a static
  `_____________________________ / Signature / date` block (e.g. reseed migration lines 4/80/230/268) with
  no data binding. G3 adds the column + token(s) + edit UI. This is the single **no-column** gap; it shows
  up as a hard-coded signature line, not as a table row above.

**G4 — counterparty form** (party-card columns already exist; ensure counterparty editability):
- All 20 Seller/Buyer tokens are **OK** — every underlying `organisations` column has an input in
  `OrganisationForm.tsx`. G4 is not adding fields; it is making the **counterparty (buyer) org** reliably
  editable through that form from the deal, and prompting for the fields that render blank
  (`country` especially — it silently controls VAT).

**G5 — orphan / unused sweep** (decide keep-vs-remove; no true orphans, but three loose ends):
- **`totals.vatReference`** — **computed but has no token** (assemble.ts:119 → types.ts:38, unused). It
  carries the legal VAT basis text. **Recommend: ADD a `totals.vatReference` token** rather than remove
  (compliance value) — but this is a G5 decision.
- **`pct advancePct`, `seller.country`, `buyer.country`, `unit`** — valid, populated tokens that **no seeded
  template uses**. Keep in the palette (custom-template value); no code change needed. Decide in G5 whether
  the default templates should surface `advancePct` and the VAT `country`/`vatReference`.
- **True orphans (token renders empty, no data home): NONE.** Every one of the 46 tokens resolves to a real
  column, a computed value, or a hardcoded constant — so there is nothing to delete for being homeless.
