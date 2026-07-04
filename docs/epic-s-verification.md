# Epic S — dynamic catalog placeholders: verification (2026-07-05)

Companion to `template-field-mapping.md`. Records the test coverage and the **live staging spot-check**
that proves a CUSTOM catalog field renders per line item, end to end.

## 1 · Test coverage (all green, tsx assertion scripts)

Run from `apps/portal` with `../../tests/rls-and-perf/node_modules/.bin/tsx <path>`.

| Suite | What it proves for the dynamic chain | Result |
|---|---|---|
| `catalog/services/__tests__/lineFieldValues.test.ts` **(added S5)** | `catalogVariantId/productId → attr map`: option-label / value-text / value-number+unit resolution, variant-over-product precedence, default packaging, empty-on-no-linkage, null-value skipping, never-throws | 20/20 |
| `documents/compiler/__tests__/slate.test.ts` | S3 column compile: `attr.<key>` column → `{{lookup attr "<key>"}}` cell, header from `columnDefs`, numeric class, order preservation, deleted-field resilience; S1 builders | 64/64 |
| `orders/services/documents/__tests__/templateMerge.test.ts` | render half: `DocLineItem.attr.glulam_grade` → `<td>GL24h</td>`, empty attr → `<td></td>` (no "undefined"); `issuer.name` / `spineCode` scalar tokens render | 37/37 |
| `orders/services/__tests__/document-assemble.test.ts` | `toDocLine` copies `attr` through; `buildDocumentData` threads `issuer`/`spineCode`/`attr`; N3 party order numbers | 42/42 |
| `documents/compiler/__tests__/validate.test.ts` | S4 validator: 3 warning kinds, dedupe, null-catalog skip, compiledHtml fallback, never-throws, **canary: every seeded template → 0 warnings** | 19/19 |
| `documents/compiler/__tests__/compiler.test.ts` · `starters/__tests__/starters.test.ts` · `orders/services/__tests__/document-render.test.ts` | compiler golden chain, starter templates, all-7-types PDF smoke | 55 · 78 · 35 |

**The chain end-to-end:** `catalogVariantId` →(readLineFieldValues, `lineFieldValues.test`)→
`DocLineItem.attr[field_key]` →(assemble, `document-assemble.test`)→ `{{lookup attr "key"}}` column
(compile, `slate.test`) →(merge, `templateMerge.test`)→ rendered per-line cell.

## 2 · Live staging spot-check (best-effort — real data, honest ceiling)

**Endpoint:** deployed staging MCP `https://timber-portal-staging.vercel.app/api/timber-mcp`
(JSON-RPC 2.0, `Bearer` full token = `SERVICE_ACTOR`). **DB reads/writes:** Supabase Management API on
`fyzrtqsnmnizoxgcqsjc`. No prod touched, no deploy.

### What was proven live

**(a) Enrichment on real staging data** — `timber_get_document_data` (= `assembleDocumentData`, the real
S2 enrichment) for deal `afa627df-2ea8-4350-8a15-64b40c4a8e45` (**ORD-171 / ART-TWG-067**, spine
**SP-078**), `doc_type: purchase_spec`, returned two `[DEMO] Glulam Beam GL28h Spruce` lines with:

| line | `attr.demo_grade` | other resolved `attr` (excerpt) | `_packaging` / `_piecesPerPackage` |
|---|---|---|---|
| 1 | **B - Standard** | `demo_strength_class=GL28h`, `demo_moisture_pct="12 %"`, `demo_density="470 kg/m3"`, `demo_lam_thickness="40 mm"`, `demo_fire_rating=R301`, `demo_ce_marked=true` | Large Pallet / 20 |
| 2 | **C - Utility** | (same field set, variant-specific values) | Half Pallet / 5 |

Also on the payload: `spineCode = "SP-078"` (resolved via `deal.spineId → spines.code`), and
**`issuer = null`** — confirming the S2 house-only gate (an MCP `SERVICE_ACTOR` generation carries no
generator identity; the custom fields + spine still populate). All three EAV resolution modes are visible
(option label `GL28h`, verbatim text, and number+unit `"12 %"`, `"470 kg/m3"`).

**(b) Render on that live data** — the exact returned `DocumentData` was fed through the REAL
`compileSlateTemplate → mergeTemplate` pipeline (the same `mergeTemplate` the Gotenberg adapter drives)
with a `line_items` table carrying an `attr.demo_grade` (+ `attr.demo_strength_class`) column. Output:

```
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Grade</th><th>Strength</th>
<th class="num">Pcs</th><th class="num">m³</th></tr></thead><tbody>
<tr><td class="num">1</td><td>[DEMO] Glulam Beam GL28h Spruce</td><td>B - Standard</td><td>GL28h</td>…</tr>
<tr><td class="num">2</td><td>[DEMO] Glulam Beam GL28h Spruce</td><td>C - Utility</td><td>GL28h</td>…</tr>
</tbody></table>
```

Per-line `<td>B - Standard</td>` / `<td>C - Utility</td>` rendered; `spineCode` SP-078 rendered; the
`issuer=null` hide-when-empty block was correctly OMITTED; no unresolved `{{` and no literal `undefined`.

### The ceiling — why a Gotenberg PDF with the custom column was NOT force-generated

Document generation (`generateDocument` → `getDocumentGenerator`) uses either the **interim local jsPDF
renderer** (ignores templates entirely) or the **Gotenberg** adapter. The Gotenberg adapter's
`loadDefaultTemplateHtml` loads **only the `is_default = true` template** for the doc type — there is **no
way to select a non-default template through generation**. On staging **all 7 `document_templates` rows are
`is_default = true` and none references an `attr.<key>` column.** So a real generated PDF would show the
custom column ONLY if Nils's DEFAULT template were edited to add it — which S5 must not do (the ground rule
forbids clobbering the default templates, and there is no spare non-default template to clone into the
generation path). Per the task's "don't force it" guidance, the fully-live Gotenberg-PDF path is deferred
to the manual step below; the enrichment + render halves above prove the mechanism on real data.

### Manual steps for a shipped PDF (for Edgars / Nils)

1. Portal → **Document Templates** → open the **Purchase Specification** (or Sales Specification) default
   template in the visual editor.
2. In the **line-items table**, use the column control to insert the custom **Grade** column
   (`attr.demo_grade`) — and any other custom fields (Strength class, etc.). Save. (The S4 banner will show
   0 warnings; the column persists as `attr.demo_grade` in `columns`/`columnDefs`.)
3. Generate a **purchase_spec** on **ORD-171 (ART-TWG-067)** — the generated PDF shows **Grade = B -
   Standard** on line 1 and **C - Utility** on line 2 (issuer blank, since generated by the house — or via
   MCP, by design).

### Cleanup

- `timber_get_document_data` on `purchase_spec` allocated a `deal_counters` row
  (`doc:purchase_spec:order:afa627df…`, `last_value=1`) — **created by this probe and deleted afterward**
  (verified: the deal has only a pre-existing `invoice` ART0001, no purchase_spec). The `sales_spec` /
  `contract` probes were rejected by the D3 affinity check **before** counter allocation, so they burned
  nothing. `timber_generate_document` was **not** called → no `order_documents` row, no storage file. No
  template or deal data was created or modified. Staging left as found.
