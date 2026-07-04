# Template placeholder → data-source audit (Epic S refresh)

_Refreshed **2026-07-05** for **Epic S** (Documents — dynamic catalog placeholders + template
validation). Supersedes the Epic-G1 snapshot (2026-07-03), whose per-group tables below stay accurate
for the classic scalar tokens; this refresh adds the tokens that landed since G1 and the **dynamic**
mechanism G1 could not describe._

This document walks **every merge-field token the document templates can place** and maps each to
(a) its data source (a real DB column, a value computed in `assemble.ts`, or a hardcoded constant),
(b) where a house user edits that source in the portal today (or `NONE`), and
(c) a status. Originally the input for the Epic G subtasks **G2** (deal-terms editor), **G3** (signee),
**G4** (counterparty form), **G5** (orphan/unused sweep) — all now landed. Every row resolves to a
definite source — there are **no `unknown` rows**.

**What changed since the G1 snapshot** — the net-new tokens + the dynamic mechanism are tabulated in
§"Epic S — dynamic placeholders" below; the six G-group tables further down stay as the classic-scalar
reference (still accurate for the rows they list):
- **G3 · signee** → `seller.signeeName/signeeRole` + `buyer.signeeName/signeeRole` (4 new tokens).
- **N3 · party order numbers** → `customerOrderNo` / `supplierOrderNo` scalar tokens (2 new).
- **G5 · VAT basis** → the once-orphaned `totals.vatReference` now HAS a token (1 new; the G1 "data
  with no token" loose end is closed).
- **S1/S2 · issuer + spine** → a new **Issuer** group (`issuer.name/email/phone`, 3 new, house-gated) +
  `spineCode` (1 new).
- **S1–S3 · dynamic catalog fields** → per-line `attr.<field_key>` line-item COLUMNS (unbounded), the
  first placeholders whose token set is DATA-DRIVEN, not hardcoded in the registry.
- **S4 · template validation** → a WARN-only pass that flags placeholders that won't resolve.

**Authoritative token list:** `apps/portal/src/features/documents/compiler/registry.ts`
(`MERGE_FIELD_GROUPS` lines 27–111 — Document/Seller/Buyer/**Issuer**/Terms/Totals,
`LINE_ITEM_COLUMNS` lines 128–137, dynamic-column builder `catalogFieldColumn` lines 188–195).
**Render shapes:** `apps/portal/src/features/orders/services/documents/types.ts` (`DocumentData`,
`DocLineItem.attr`).
**Population logic:** `apps/portal/src/features/orders/services/documents/assemble.ts` (pure) +
`apps/portal/src/features/orders/services/orderDocuments.ts` (DB-bound: party cards, `attr` enrichment,
house-only issuer, spine-code lookup).
**Dynamic-field plumbing:** reader `apps/portal/src/features/catalog/services/lineFieldValues.ts` ·
action `apps/portal/src/features/catalog/actions/fields.ts::getCatalogTemplateFields` ·
editor hook `apps/portal/src/features/documents/plate/hooks/use-catalog-template-fields.ts` ·
validator `apps/portal/src/features/documents/compiler/validate.ts`.

Status legend: **OK** = correct source + edit UI (or correctly system-computed, no edit needed) ·
**no-UI** = has a DB column but no portal edit surface · **no-column** = no backing column anywhere ·
**hardcoded** = value fixed in code · **dynamic** = token/column set is resolved from catalog data at
edit time (not a fixed registry entry) · **orphan** = token renders empty with no data home.

---

## Epic S — dynamic placeholders (2026-07-05 refresh)

Epic S turned the template merge-field set from a **fixed registry** into a **static core + a data-driven
tail**. Three things landed: (1) the classic scalar registry grew (issuer group, spine code, party order
numbers, the VAT-reference token); (2) documents can now place **per-line custom catalog fields** as
`attr.<field_key>` line-item COLUMNS whose set is resolved from the live catalog, not hardcoded; and
(3) a **WARN-only validator** flags placeholders that won't resolve. This section is the authoritative
map for everything new; the classic Document/Seller/Buyer/Terms/Totals/Line-item tables below are the
G1 baseline for the rows they already covered.

### S.a · New scalar tokens (registry.ts `MERGE_FIELD_GROUPS`)

| Token | Group | Data source | Population | Status |
|---|---|---|---|---|
| `spineCode` | Document | `spines.code` (SP-###) resolved via `deal.spineId` | orderDocuments.ts (`admin.from("spines").select("code")…`) → threaded through `assemble.ts`; **null** when the deal has no spine | OK (system, no edit UI — spine identity is assigned, not typed) |
| `customerOrderNo` | Document | the deal's external ref of type `customer_order_no` | `assemble.ts` `refValueOf(CUSTOMER_ORDER_NO_REF_TYPE)`; also stays in the `externalRefs` block; **null** when unset | OK — editable via MCP `timber_set_external_refs` / the refs editor |
| `supplierOrderNo` | Document | external ref of type `supplier_order_no` | `assemble.ts` `refValueOf(SUPPLIER_ORDER_NO_REF_TYPE)`; **null** when unset | OK — same editor |
| `issuer.name` | **Issuer** (new group) | the house `portal_users.name` of the user who GENERATED the doc | `orderDocuments.resolveIssuer` — **house-only gate** | OK (system; identity of the generator) |
| `issuer.email` | Issuer | `portal_users.email` of the generator | `resolveIssuer` | OK |
| `issuer.phone` | Issuer | `portal_users.phone` of the generator | `resolveIssuer` | OK |
| `seller.signeeName` / `seller.signeeRole` | Seller | `PartyCard.signee*` — deal override → seller org default (`default_signee_*`) (G3) | fetched in the party card; per-deal override via `seller_signee_name` on `timber_create_deal`/`update_deal` | OK — edit UI: org card default + deal-panel override |
| `buyer.signeeName` / `buyer.signeeRole` | Buyer | same, from the buyer org / `buyer_signee_name` override | party card | OK |
| `totals.vatReference` | Totals | `resolveVat(...).reference` — the legal VAT-basis clause, route-selected | computed in `assemble.ts` (G1's "data with no token" loose end — G5 added the token) | OK (derived) |

**Issuer house-only gate (S2, `resolveIssuer`).** `issuer` is populated ONLY when the acting user is a
concrete portal user, is **NOT a service agent**, and is either a platform admin or a member of the deal's
**seller (house)** org. A **counterparty** generate, or **any MCP / service-actor** generate, resolves
`issuer = null` → the three `issuer.*` tokens render empty (and their hide-when-empty blocks vanish). This
is deliberate: a document the other party reads must never leak the generating person's identity.
*Verified live on staging:* an MCP `SERVICE_ACTOR` generation returned `issuer: null` while the custom
fields + `spineCode` still populated (see `epic-s-verification.md`).

### S.b · Dynamic per-line catalog columns — `attr.<field_key>` (S1–S3)

Custom catalog attributes (a glulam grade, strength class, coating, moisture %, …) are **per-line-item**,
so they surface as dynamic **line-item COLUMNS**, never scalar mentions (a scalar `attr.<key>` outside the
`{{#each lineItems}}` loop would render empty). The token set is **data-driven** — it is whatever custom
fields the catalog currently defines — so it can't live as fixed registry rows. The mechanism, end to end:

1. **Discovery** — `getCatalogTemplateFields()` (`catalog/actions/fields.ts`) returns the catalog's CUSTOM
   fields (`getAllFields` minus system dimension fields), each as `{ fieldKey, fieldLabel, fieldType,
   unit, categories }`.
2. **Editor load** — the Plate editor's `useCatalogTemplateFields()` hook
   (`documents/plate/hooks/use-catalog-template-fields.ts`) fetches them ONCE (module-cached, one
   round-trip per page; degrades to `[]` on failure — the editor never crashes because catalog fields
   failed). It also builds the `attr.<fieldKey> → fieldLabel` map that is **composed on top of** the
   static `MERGE_FIELD_LABELS` for friendly pill labels — the static map is never mutated.
3. **Column build** — `catalogFieldColumn(field)` (`compiler/registry.ts`) emits a `LineItemColumn` keyed
   `attr.<fieldKey>`, header = the field label, cell = **`{{lookup attr "<fieldKey>"}}`** (a robust lookup
   that resolves ANY key and is NOT gated by the scalar `SAFE_TOKEN` guard), `num` right-aligns `number`
   fields. The S3 column designer stores the chosen columns on the `line_items` node as `columns` +
   `columnDefs` (so the compiler stays **DB-free** — the resolved header/num travel in the doc JSON).
4. **Compile** — `compileSlateTemplate` renders the `line_items` node to `…<th>Grade</th>…{{lookup attr
   "demo_grade"}}…` inside the `{{#each lineItems}}` loop. A deleted field still compiles (header falls
   back to the key, cell resolves to empty) — no crash.
5. **Data (assembler enrichment, S2)** — `orderDocuments.assembleDocumentData` enriches each order line
   with `attr` via `buildLineAttr` → **`readLineFieldValues`** (`catalog/services/lineFieldValues.ts`),
   which reads `catalog_variant_field_values` ∪ `catalog_product_field_values` (variant wins) and resolves
   each value to a display string: **option_id → option label**, else **value_text verbatim**, else
   **value_number + unit** (`"12 %"`, `"470 kg/m3"`). The pure `assemble.ts` only copies `attr` through, so
   it stays DB-free. Classic keys (`wood_species`/`humidity`/`processing`/`quality`/`panel_type`) fall back
   to the line's own stored scalar when the catalog has no value.
6. **Render** — `mergeTemplate` (the same merge Gotenberg drives) resolves `{{lookup attr "demo_grade"}}`
   against `DocLineItem.attr` → the per-line value, empty (not `undefined`) when absent.

| Placeholder | Data source | Populated by | Status |
|---|---|---|---|
| `attr.<field_key>` (line-item column) | catalog EAV: `catalog_variant_field_values` ∪ `catalog_product_field_values` → display string | `buildLineAttr` → `readLineFieldValues`; copied through `assemble.ts`; rendered `{{lookup attr "<key>"}}` | **dynamic** (set resolved from the live catalog; editable in Catalog → Fields) |
| `attr._packaging` (reserved) | the variant's DEFAULT packaging **name** | `readLineFieldValues` reads `catalog_variant_packaging_assignments` (is_default row, else first) → `buildLineAttr` writes `attr._packaging` | **dynamic** — best-effort; empty when no default packaging |
| `attr._piecesPerPackage` (reserved) | that packaging's `pieces_per_package` | same | **dynamic** — best-effort |

*Verified live on staging* (order `ART-TWG-067` / ORD-171, spine SP-078): two glulam lines returned
distinct `attr.demo_grade` = **"B - Standard"** / **"C - Utility"**, plus `demo_strength_class="GL28h"`,
number-with-unit values (`demo_moisture_pct="12 %"`, `demo_density="470 kg/m3"`), and reserved
`_packaging`/`_piecesPerPackage` per line — then rendered through the real compile→merge pipeline into
per-line `<td>B - Standard</td>` / `<td>C - Utility</td>` cells (`epic-s-verification.md`).

### S.c · Template validation (S4, `compiler/validate.ts`)

`validateTemplate(...)` is a **PURE, WARN-only, never-throws** pass wired into `saveTemplate`
(WARN-only — it never blocks a save) and run live in the editor. It walks the Plate tree and reports three
kinds of placeholder that WON'T resolve at generation time, so a house author catches a stale binding
before it ships as a silently-empty field:

| Warning kind | Fires when | Example message |
|---|---|---|
| `unknown_token` | a scalar `mention` whose base path is neither a known `DocumentData` binding nor a live catalog `attr.<key>` | `Placeholder "{{seller.bogus}}" won't resolve — no matching deal field.` |
| `unknown_field` | a line-items `attr.<key>` COLUMN whose `<key>` is no longer a catalog field (deleted/renamed) | `Table column "gone_field" refers to a catalog field that no longer exists.` |
| `unknown_condition` | a block `hideWhen` referencing an unknown path (the `{{#if}}` is always-false → block always hidden) | `Hide-when-empty condition "ghost.path" references an unknown field.` |

Resolution is base-path aware (a valid binding minus its helper prefix still resolves). `attr.<key>` checks
are **SKIPPED** when the catalog field set is `null` (a transient DB read failure / still loading) so a load
glitch never produces false "deleted field" warnings; pass `[]` only when the catalog is genuinely empty.
The DB read that supplies `catalogFieldKeys` happens in the CALLER — the validator only compares strings.

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

**Counts (Epic S refresh, 2026-07-05).** Scalar registry tokens = **49**
(Document **9** · Seller **12** · Buyer **12** · **Issuer 3** · Terms 5 · Totals **8**), up from the 41
scalars at G1 (+`spineCode`, +`customerOrderNo`, +`supplierOrderNo`, +Issuer×3, +`seller/buyer.signee*`×4,
+`totals.vatReference`; net +8). Line-item **columns = 8 fixed** (`LINE_ITEM_COLUMNS`) **+ a data-driven
tail** of `attr.<field_key>` columns (one per custom catalog field — unbounded, incl. reserved
`attr._packaging` / `attr._piecesPerPackage`). **Orphans: still 0** — G1's one "data with no token"
(`totals.vatReference`) is now a real token, and every dynamic `attr.<key>` resolves through
`readLineFieldValues`. All of G2–G5 have since landed; the routing notes below are retained for history.

> The G1 baseline line (below, for reference): 46 tokens total (Document 6 · Seller 10 · Buyer 10 ·
> Terms 5 · Totals 7 · Line-item 8) — OK 38 · no-UI 7 · hardcoded 1 · no-column 0 · orphan 0. Since then
> the no-UI count shrank (G2 terms editor, N3 refs editor) and no-column closed (G3 signee).

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
