# WYSIWYG Document-Template Editor — Implementation Plan

**Branch:** `feature/wysiwyg-doc-editor` (isolated git worktree off `feature/timber-spec-phase` @ `ebbf6eb` = E6+E7).
**Task:** AgentWave project `0d2f3a0a-0755-4274-9218-227812cc6083` — reactivates the postponed E6 subtask `st3x5d` ("In-app Plate rich-text template editor").
**Status:** **BUILT — W0–W7 done + committed** on `feature/wysiwyg-doc-editor` (verify UI via `next build && next start`, not `next dev` — canary Turbopack hydration bug). Design de-risked by a 5-agent workflow. Verdict: **GO on TipTap v3.**

## Completion summary (2026-07-02)

| Epic | What shipped | Proof |
|------|--------------|-------|
| W0 | TipTap v3 deps + pnpm overrides + compiler skeleton | single react/pm/prosemirror; editor mounts (zero console errors); 12/12 compile→merge smoke |
| W1 | Additive schema (`doc_json`/`content_format`/`page_settings`/`logo_path`) + public `template-assets` bucket | applied to staging; 7 seeds unchanged; templateMerge 31/31 + document-render 35/35 |
| W2 | Pure JSON→Handlebars compiler (registry/nodes/shell) | 55/55 golden tsx + adversarial review 10/10 fixed |
| W3 | TipTap editor + MergeField & LineItemsTable nodes + toolbar | mounts + renders in a production build (pills, line-items designer) |
| W4 | Visual + Advanced(HTML) tabs; server-side compile-on-save (trust boundary) | staging integration: stored html === server-compiled; renders correctly |
| W5 | Logo upload (public bucket), page settings, hide-when-empty | staging bucket round-trip: public logo fetchable with no auth |
| W6 | 7 visual starter documents + New-from-starter | 78/78 starter tsx assertions |
| W7 | **E2E real-Gotenberg render** + adversarial review + docs | a starter+logo → real Gotenberg PDF (33 KB, logo embedded as image XObject); all 7 starters → %PDF |

**Render path stayed FROZEN throughout** — `templateMerge.ts` + `gotenberg.ts` never modified (git-verified per epic).

**Remaining (needs Edgars):** merge `feature/wysiwyg-doc-editor` → `feature/timber-spec-phase` + deploy to staging so Nils can feel-test the auth-gated Settings → Document Templates UI (visual editing, insert-field, line-items designer, logo, generate a PDF).

---

## 1. Goal

Replace the E6 "lightweight" template editor (a raw HTML/Handlebars `<textarea>` + token-insert palette) with a **full WYSIWYG document editor** Nils can use like Word / Google Docs — for the 7 global document templates (sales spec, purchase spec, contract, proforma, invoice, packing list, CMR).

**In scope (locked with Edgars):**
- Rich text: headings, paragraphs, **bold/italic/underline**, bullet & numbered lists, text alignment, links, **tables** (add/remove rows & cols).
- **Merge-field pills** — insert placeholders (Seller name, Total, Date, …) from a friendly grouped menu, shown as atomic chips, never raw `{{tokens}}`.
- **Repeating line-items table** — design one row; it auto-expands per product line at generation time (compiles to `{{#each lineItems}}`).
- **Logo / letterhead** — image upload + optional page header/footer + A4 margins.
- Visual editor is the **default** surface; the existing raw-HTML code view stays as an **"Advanced (HTML)"** tab (for legacy templates, `.docx` imports, power tweaks).
- Re-create the 7 seeded templates as **visual starter documents**.

**Deferred (follow-ups):** generic loops over arbitrary collections; a full nested-conditional editor (only a per-field "hide when empty" → `{{#if}}` is in scope); an HTML→visual importer for arbitrary legacy templates; true Gotenberg running header/footer file-split; `.docx`→visual conversion (docx import keeps landing in the Advanced tab); adding vitest/CI test task.

## 2. Architecture — SOURCE → COMPILE → RENDER (one-way)

The single most important constraint: **the render pipeline stays frozen.** `templateMerge.ts` + `gotenberg.ts` read **only** `document_templates.html`. We never modify them and never make generation read the new JSON.

1. **TipTap JSON is the editable source of truth**, persisted in a new additive `document_templates.doc_json` (jsonb) column.
2. On every save of a `wysiwyg` row, a **pure, deterministic, framework-free TypeScript compiler** walks the JSON and emits a full `<!DOCTYPE html>` Handlebars document into the **existing `html` column** — server-side, inside `saveTemplate` (which uses the RLS-bypassing service-role client, so **the server is the trust boundary; client-sent html is ignored for wysiwyg rows**).
3. **We never parse Handlebars HTML back into JSON.** JSON↔editor round-trips losslessly via TipTap `getJSON`/`setContent`; HTML is a derived artifact.

**Content-format routing:** a new `content_format` column (`'html'` | `'wysiwyg'`, default `'html'`) selects which tab opens. The 7 seeds + `.docx` imports stay `'html'` (doc_json NULL) and open in **Advanced (HTML)** — unchanged. New templates default to `'wysiwyg'`. Opening a wysiwyg row in Advanced warns that a raw edit performs a **one-way switch** to `content_format='html'` (drops doc_json).

**Packaging:** the entire editor lives in **`apps/portal/src/features/documents/`** — **not** `@timber/ui` (avoids double-React/ProseMirror hoisting and keeps TipTap off marketing/other-app bundles). `@tiptap/*` deps go in `apps/portal/package.json` only. The compiler (`features/documents/compiler/`) imports **no** react/@tiptap so the save action never bundles the editor.

**Live preview:** `previewTemplateJson(docJson, docType, pageSettings)` → `compileTemplate` → existing `mergeTemplate` against a sample `DocumentData` → existing sandboxed (no-scripts) iframe. The trader only ever sees **merged sample values**, never a raw token.

## 3. Library — TipTap v3 (LOCKED)

Headless ProseMirror editor (ueberdosis), MIT, ships zero CSS (lives inside our Tailwind v4 design system — the property that sidesteps the Plate/Tailwind-v4 conflict that parked this last time). React 19.2 + Next 16.1 App Router fully supported.

Packages (pin the whole set to one identical version):
`@tiptap/react@^3.27.1`, `@tiptap/pm@^3.27.1`, `@tiptap/core@^3.27.1`, `@tiptap/starter-kit@^3.27.1`, `@tiptap/extension-text-align@^3.27.1`, `@tiptap/extension-image@^3.27.1`, `@tiptap/extension-table@^3.27.1`. (v3 folds Underline+Link into StarterKit and consolidates tables into `TableKit`.) All in-scope features are MIT — no Pro key.

**Stack gotchas (must-do):**
- Install `@tiptap/*` into `apps/portal` **only**; add root `pnpm.overrides` pinning `react`/`react-dom` to `19.2.3`; **never** install a bare `prosemirror-*` (only `@tiptap/pm`). Verify `pnpm why react` & `pnpm why @tiptap/pm` each resolve to a single version. (Duplicate react → "Invalid hook call"; duplicate pm → "Adding different instances of a keyed plugin (plugin$)".)
- `useEditor({ immediatelyRender: false, shouldRerenderOnTransaction: false })` — SSR safety (avoids React #418/#425 hydration mismatch); drive toolbar state via `useEditorState`.
- `'use client'` on every editor file **and every ReactNodeView** (merge-field pill, line-items designer).
- Tailwind v4 Preflight zeroes list bullets / heading sizes / table borders inside `.ProseMirror` → re-apply in `editor.css` (editor chrome only; the compiler's `BASE_CSS` is independent, so the PDF look never depends on Preflight).
- Uncontrolled editor: set initial content once from `doc_json`, read `getJSON()` on save; push external updates with `setContent(json, false)` guarded against cursor jumps.

**Fallback:** Lexical (only if an unresolvable pnpm ProseMirror duplicate survives dedupe/overrides, or a custom node proves non-serializable — neither expected). Ultimate fallback: keep the raw-HTML textarea as the sole editor behind `content_format='html'`.

## 4. Data model (additive, idempotent — staging first)

**`20260702000001_document_templates_wysiwyg.sql`** — on `public.document_templates`, all `ADD COLUMN IF NOT EXISTS`:
- `doc_json jsonb` (TipTap doc; NULL for legacy rows)
- `content_format text NOT NULL DEFAULT 'html'` + guarded CHECK `content_format IN ('html','wysiwyg')` (constraint `document_templates_content_format_chk`, added in a `DO $$…$$` block so re-run is safe)
- `page_settings jsonb` (e.g. `{marginMm, footerText, logoUrl}`)
- `logo_path text` (storage object path for replace/cleanup)

No backfill → the 7 seeds keep `content_format='html'`, `doc_json` NULL, `html` byte-unchanged. `html` stays NOT NULL and remains the only render input. Partial unique index (one default per type), RLS write policy, and the `documents.view` read gate are all preserved.

**`20260702000002_template_assets_bucket.sql`** — create a **PUBLIC** `template-assets` storage bucket (`ON CONFLICT DO UPDATE SET public=true`) + `storage.objects` policies modelled on the existing marketing bucket (public SELECT; authenticated INSERT/UPDATE/DELETE), each wrapped in `DROP POLICY IF EXISTS … ; CREATE POLICY …`. Public read is deliberate so **Gotenberg's Chromium fetches the logo `<img src>` with no bearer**. The real write guard is the platform-admin gate in the upload server action.

**Types** (`features/documents/types.ts`): extend `DocumentTemplate`/`Summary` with `docJson`, `contentFormat`, `pageSettings`, `logoPath`; extend `SaveTemplateInput` with optional `docJson`/`contentFormat`/`pageSettings`; add `PreviewTemplateJsonInput`. Map new columns in `actions/templates.ts` (`getTemplate` already `select('*')`; add `content_format` to the `listTemplates` column list).

## 5. Compiler (`features/documents/compiler/`) — the crown jewel

Pure, synchronous, zero-I/O, no react/@tiptap. Files: `types.ts`, `registry.ts` (COLUMN_MAP + merge-field catalog — the **single source** shared by compiler + palette + designer so labels/tokens can't drift), `nodes.ts` (node/mark serializers), `shell.ts` (BASE_CSS + `@page` + logo header/footer), `index.ts` (`compileTemplate`).

`compileTemplate(doc, { pageSettings, docType })` → a complete standalone Handlebars-HTML document. `BASE_CSS` is **lifted verbatim from the seeded `<style>`** so PDFs match today's look independent of Tailwind.

**Three invariants:**
1. **Text escaping** — text nodes HTML-escaped once (`& < > "`) **and stray braces neutralised** (`{`→`&#123;`, `}`→`&#125;`), so literal user text can never become a live Handlebars expression.
2. **Tokens raw** — only `mergeField` / `lineItemsTable` write `{{…}}` literally (never escaped); `templateMerge` keeps `noEscape:false` so merged *values* stay escaped at render (unchanged posture).
3. **One-way** — never parse Handlebars HTML back to JSON.

Node/mark serialization (highlights):
- `mergeField` (inline atom, attrs `{token,label,hideWhen?}`) → `{{ token }}` (token carries the helper prefix, e.g. `money totals.totalCents`→`{{money totals.totalCents}}`). `hideWhen` → wrap `{{#if PATH}}…{{/if}}`, PATH = token minus helper prefix.
- `lineItemsTable` (block atom, attrs `{columns,…}`) → `<table class="items"><thead>…</thead><tbody>{{#each lineItems}}<tr>…</tr>{{/each}}</tbody></table>`, cells item-scoped via COLUMN_MAP (`lineNo`→`{{lineNo}}`, `volumeM3`→`{{fmtM3 volumeM3}}`, `unitPriceCents`→`{{money unitPriceCents}}`, …). **Byte-shape-identical** to the seeded `<tbody>{{#each lineItems}}…{{/each}}</tbody>`.
- headings/paragraphs → `<h1-3>`/`<p style="text-align:…">`; lists → `<ul>/<ol><li>`; marks (fixed priority link→bold→italic→underline); `link`→`<a href>`; `image`→`<img src="publicURL" style="max-height:64px">`; user `table` (TableKit) → normal `<table class="rt-table">` that **never** emits `{{#each}}`.

## 6. Logo / letterhead

Upload to the **public** `template-assets` bucket via a platform-admin-gated `uploadTemplateLogo` action (path `templates/{templateId||tmp}/{ts}-{rand}.{ext}`; ≤2MB; png/jpg/webp/svg). Store the **public URL** in the image node attrs + `page_settings.logoUrl` (inside doc_json) and the object path in `logo_path`. Compiler emits `<img src="{publicUrl}">` — Chromium fetches with no auth (a signed/private URL would render broken; data-URI is a fallback only for tiny inline marks). Page settings (`marginMm` + optional running footer, which may itself contain merge fields) → `@page{margin}` + optional `position:fixed` footer div.

## 7. Epics (build order — risk front-loaded)

| ID | Title | Depends |
|----|-------|---------|
| **W0** | Stack-validation spike (throwaway) + real Gotenberg render proof | — |
| **W1** | Additive schema + `template-assets` bucket + type plumbing (zero behaviour change) | W0 |
| **W2** | JSON→Handlebars compiler (pure TS, tsx-unit-tested, ZERO UI) — crown jewel | W1 |
| **W3** | TipTap editor + `MergeField` & `LineItemsTable` nodes + toolbar + Tailwind CSS | W2 |
| **W4** | Wire Visual + Advanced(HTML) tabs into the manager; save compiles JSON→html server-side | W3 |
| **W5** | Field palette, line-items designer, logo upload, page settings, hide-when-empty (no token leak) | W4 |
| **W6** | Re-create the 7 seeded templates as visual starters | W5 |
| **W7** | E2E Gotenberg proof, adversarial + token-leak review, docs | W6 |

**W0** proves (before any real code): TipTap mounts clean on Next 16 / React 19 / Tailwind v4 / pnpm with a single react + prosemirror instance (`pnpm why`), and one hand-authored JSON flows JSON→compiler-skeleton→`mergeTemplate`→**real Gotenberg**→valid PDF. Scratch route + spike editor are deleted after; only the dep install + `pnpm.overrides` survive.

## 8. Testing / proof (repo convention — no new runner)

Use the repo's existing **tsx assertion-script** convention (like `document-render.test.ts`), run via `../../tests/rls-and-perf/node_modules/.bin/tsx`. Key gates:
- **Golden chain (W2):** `compileTemplate(fixture)` === expected Handlebars HTML, then `mergeTemplate(that, sample)` === expected rendered string — importing the **real** `templateMerge.ts`, proving the compiler emits Handlebars the frozen pipeline accepts (`{{money totals.totalCents}}`→`2 029,97`, 3 loop rows, escaped party names).
- **Adversarial/security (W7):** literal `{{money x}}` typed as text stays inert; braces neutralised; hide-when-empty path stripping; content_format one-way switch; token-leak audit (zero visible `{{` on any Visual surface).
- **E2E (W7):** compile a visual starter with logo → real Gotenberg → validate `%PDF` + embedded logo (env-guarded on `GOTENBERG_URL`; uses staging `https://gotenberg.ideajetlab.com` + bearer).
- `pnpm turbo run type-check` across apps before every deploy (validate-before-done).

## 9. Risk register (top)

- **pnpm double-instance** (react/prosemirror) → hook/plugin errors. → portal-only install + root overrides + only `@tiptap/pm`; verified in W0.
- **Tailwind v4 Preflight** strips editor typography. → re-apply in `editor.css` (chrome only; PDF uses independent BASE_CSS).
- **Raw `{{token}}` leaking to a trader** (#1 UX risk). → pills show friendly labels; menu/designer label-only; preview shows merged values; compiler neutralises stray braces; explicit W7 leak audit.
- **Client desyncs html from doc_json** (service-role save). → wysiwyg saves always recompile server-side, ignore client html.
- **Compiler drifts from seeded look.** → BASE_CSS lifted verbatim; golden exact-string tests; shared registry; starter snapshots.
- **Gotenberg can't fetch a gated logo URL.** → public bucket + public URL; W5 HTTP-checks it; W7 renders a real PDF with the logo.
- **Breaking the frozen render path.** → `templateMerge.ts` + `gotenberg.ts` never modified; W1 regression-runs the render test. Treat any diff to those two files as a red flag.

## 10. Open questions — resolved with defaults (no blocker)

1. **E2E Gotenberg endpoint** → use staging `GOTENBERG_URL=https://gotenberg.ideajetlab.com` + `GOTENBERG_BEARER`; test env-guarded (skip when unset).
2. **Logo cap/types** → ≤2MB, png/jpg/webp/svg (svg sanitised), always hosted public URL (data-URI only <~20KB).
3. **Starter promotion** → manual (non-destructive) via the existing `setDefaultTemplate`.
4. **CHECK migration on prod** → runs on **staging** now (spec phase is staging-only; prod cutover is E8), fast metadata op on a tiny table — no window needed.

## Coordination note

Built in an isolated worktree (`.worktrees/wysiwyg-editor`, branch `feature/wysiwyg-doc-editor`) to avoid colliding with a concurrent E7 agent that shares the `timber-world` tree. Merge back to `feature/timber-spec-phase` (or PR) when done. Bus run `4b76e358`.
