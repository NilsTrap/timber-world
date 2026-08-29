---
title: 'Quotation workbench, line-item commercial roll-up, and spine images'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_commit: 'e351148ad0cc8038fb4ffbc58499b4b81496a489'
context:
  - '../project-context.md'
  - '../../docs/Timber_World_Trading_Platform_Specification.pdf'
  - '../../../_bmad-output/implementation-artifacts/spec-spine-lego-leg-rfq-award.md'
  - '../../../_bmad-output/implementation-artifacts/spec-project-spec-fields-and-rfq-pricing.md'
  - 'spec-project-awarded-quotation-margin.md'
---

## Intent

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

**Problem:** Structured supplier quotations are stored, but managers cannot reliably reopen and inspect their line/process prices after submission or award. Awarded supplier values and trader margins also stop on the sourcing leg instead of being assembled into the commercial offer on a buyer-facing leg. Finally, the three project images are stored against one order, so sibling legs on the same spine do not share the same gallery.

**Approach:** Add a role-safe quotation workbench with persistent quotation detail and admin correction; add an explicit, line-item-based commercial roll-up that snapshots selected awarded sourcing values into a target selling leg before applying that trader's margin; and move the three-image gallery designation from an order to the spine while retaining one underlying project file per image.

## Proposed Boundaries & Constraints

**Always:**

- A supplier can create or revise only its own quotation while the RFQ is open and before award.
- Award locks supplier editing. A platform admin can inspect and correct any quotation, including the awarded quotation.
- The manager of an RFQ and platform admin can see all candidate quotations for that RFQ; candidates can see only their own quotation.
- A quotation detail shows every priced specification line/process, quantity, unit price, calculated subtotal, notes, total, submitter, and timestamps.
- Server code recalculates all totals from integer cents; client totals are previews only.
- Each sourcing leg can contain any non-empty subset of the spine's specification lines and quantities. Its RFQ and supplier quotation apply only to that work package.
- A buyer-facing selling price is built explicitly from one or more awarded source legs. Each selected source contribution is mapped to canonical spine line IDs and copied as a snapshot.
- A target leg can combine several source legs, including two suppliers covering different lines. It cannot consume more than the target work-package quantity for any spine line.
- Each trader sees only its own purchase-cost sources, own margin, and own sales amount. A downstream buyer sees the offered total and offered line values, not upstream supplier identities, quotations, costs, or margin.
- Editing an awarded quotation marks that sourcing leg's saved margin/sales pricing and every dependent downstream roll-up stale. Nothing is silently recalculated or overwritten; each owning trader must explicitly review and reconfirm.
- The three project images are spine-wide, retain positions 1–3, and are identical in every authorized leg view. For MVP they are stored on the spine's canonical `origin_order_id`; position 1 is the project-list thumbnail.

**Ask First:**

- Automatically propagating or overwriting prices without trader confirmation.
- Partial award to several candidates within one RFQ; MVP continues to use one winner per RFQ/leg.
- Currency conversion, taxes, discounts, freight formulas, or document generation.
- Letting a trader alter a supplier's submitted quotation. This wave grants post-submission correction only to platform admin.
- Changing the canonical spine specification from a downstream leg.

**Never:**

- Expose competing quotations to suppliers or upstream cost/margin to buyers.
- Dynamically link a confirmed downstream offer so later upstream edits silently change it.
- Store money as floating-point values.
- Duplicate the project image files into every leg.
- Infer commercial roll-up merely from leg order or party sequence; source legs are selected explicitly.

</frozen-after-approval>

## User Experience

### 1. Quotation workbench

- Keep `Supplier quotations` visible after submission and award.
- Each candidate row has `View quotation`; platform admin also has `Edit quotation`.
- Opening a quotation shows a read-only line/process table by default.
- During an open RFQ, the invited supplier can switch its own quotation into edit mode and resubmit.
- After award, supplier controls are read-only and explain that the quotation is locked.
- Platform admin can edit any quotation in the same form at any lifecycle stage. Saving replaces the current quotation values.
- Editing the awarded quotation updates the awarded purchase cost, but marks that leg's margin/sales result and any downstream roll-up stale. The existing confirmed values remain visible as the prior snapshot until explicitly reconfirmed.

### 2. Split sourcing and cumulative selling offer

- `Create leg` continues to select the work package: one or more spine lines and an optional partial quantity for each.
- RFQ candidates see and price only that leg's selected work package.
- On a buyer-facing leg, the owning trader/platform admin gets `Build selling price`.
- The builder lists eligible awarded sourcing legs on the same spine and shows their covered specification lines and current resale values.
- The manager selects source contributions. The system groups them by canonical spine line, validates coverage, and shows:
  - source cost carried into this leg;
  - optional direct/additional cost adjustment for the target leg;
  - this trader's margin as amount or gross-margin percentage;
  - offered value by line and total sales value.
- Confirmation saves a commercial snapshot on the target leg. A later trader can use that leg's confirmed sales snapshot as its purchase-cost source and add its own margin in the same way.
- The original buyer receives only the confirmed offer for the lines included in its leg. For a full-project offer, every required spine line/quantity must be covered; incomplete coverage is clearly shown and cannot be presented as complete.

### 3. Spine-level images

- `Images` appears identically on every leg in the spine.
- Upload, screenshot capture, make-default, preview, and removal all act on the same spine gallery.
- Existing origin-order gallery rows need no data migration. If legacy sibling legs also contain image designations, preserve the origin leg's ordered images first, then move at most the remaining deterministic choices into its free slots without duplicating files.
- Access is granted only after the viewer is authorized to at least one leg of the spine. The gallery does not broaden access to ordinary project files.

## Data Model Plan

### Quotation correction

- Retain `project_rfq_candidates.quote_entries` as the current quotation snapshot.
- Reuse the existing `quote_entered_by`, `quote_entered_as_admin`, `submitted_at`, and `updated_at` fields for the current snapshot. Do not add quotation revision history for MVP.
- Every supplier submit/resubmit or admin correction replaces the candidate's current snapshot atomically.
- Post-award admin correction updates the awarded purchase cost and atomically marks the sourcing leg's existing margin/sales result plus dependent roll-ups stale; confirmed downstream numbers are not silently changed.

### Commercial roll-up

- Add `project_leg_commercial_sources`:
  - target order, source order, source awarded candidate;
  - canonical origin line, selected quantity;
  - snapshotted source amount cents and source update/version marker;
  - created by/at.
- A source is eligible only when its buyer is the target leg's seller (`source.buyer_organisation_id = target.seller_organisation_id`), it is on the same non-null spine, it has an awarded or confirmed selling price, and it is not the target itself. This prevents reversed, circular, or unrelated commercial provenance.
- Only platform admin or a trader user with the target seller organisation's deal-create right may load private source identities/costs or save its roll-up.
- Add target-leg commercial state/version fields sufficient to distinguish `draft`, `confirmed`, and `stale` roll-ups plus an explicit offer scope of `full` or `partial`.
- `full` confirmation requires exact coverage of every target line quantity. `partial` confirmation allows an intentional non-empty subset and stores/displays that label; neither mode permits over-coverage.
- Persist buyer-safe offered values per canonical origin line. Material and process quote entries are first grouped under their parent canonical line. Partial source quantities scale that line's source cost proportionally. Target additional cost and margin are allocated proportionally by line purchase cost using largest-remainder rounding so line cents equal the target total exactly; when all purchase costs are zero, allocation falls back to selected quantity.
- Extend private target-leg pricing with aggregated purchase cost, optional adjustments, trader margin, and sales amount. Preserve the already implemented `orders.margin_*` and `resale_value_cents` fields rather than creating a second margin model.
- Add a transactional RPC to preview/validate and save the complete roll-up. It rejects null/empty/duplicate input, locks the target then source orders/candidates/origin lines in sorted UUID order, validates the client-reviewed candidate `updated_at` marker, and rejects cross-spine, unauthorized, wrong-direction, non-awarded, stale, over/under-coverage, currency-mismatched, or overflow input.
- Reopening a saved roll-up loads its selected quantities, scope, additional cost, margin mode/value, line offers, and state. Saving refreshes the UI from the canonical result rather than resetting to an empty builder.

### Spine images

- The first implementation proved that order-level thumbnail columns cannot enforce three unique positions across a spine without moving files. Add a small `spine_project_images(spine_id, order_file_id, position)` designation table with unique spine positions and unique file linkage.
- Image loaders and actions resolve any viewed order to its spine, authorize the actor against the viewed spine and the approved gallery role, and read/mutate only the designation rows. Signed preview URLs are created server-side only after this authorization.
- Preserve every `order_files.order_id`, storage path, and leg-local file workspace. Upload/screenshot from a sibling stays owned by that sibling file workspace while its designation appears in the shared gallery.
- Legacy migration selects at most three distinct storage paths deterministically, preferring the origin order's positions and then sibling designations. It does not move or duplicate file bytes.
- Slot allocation/make-default/removal run under a spine-scoped lock, and every sibling detail route is invalidated through tag-based or equivalent spine-level cache invalidation.

## I/O and Edge Cases

| Scenario | Expected behavior |
|---|---|
| Manager opens submitted or awarded candidate | Full quotation detail is visible, including line/process breakdown and total |
| Supplier opens awarded quote | Full own quotation remains visible but has no editable controls |
| Admin corrects awarded unit price | Current quotation and purchase cost update; bilateral `value_cents` is preserved; saved margin/sales and dependent roll-ups become stale pending explicit reconfirmation |
| RFQ covers 2 of 5 lines | Candidate sees and quotes only those 2 work-package lines/processes |
| Two supplier legs cover metal and wood | Target trader selects both; roll-up groups their contributions by canonical line and calculates one target purchase cost |
| Two sources overlap beyond required quantity | Confirmation is rejected atomically with a line-specific error; valid partial quantities can be entered in the builder |
| One source price changes later | Existing target amount remains; UI shows stale-source warning and offers explicit refresh/reconfirm |
| Viewer opens any sibling leg | Same three spine images, same order, same default thumbnail |
| Legacy images exist on several legs | Deterministic migration keeps at most three without duplicating files |
| Unrelated user knows a spine/file ID | No quotation, commercial source, image metadata, or signed URL is returned |

## Implementation Plan

- [x] **Quotation read model** — expose current structured entries and update metadata through a role-filtered server projection; remove UI conditions that hide quotation detail after submission/award.
- [x] **Quotation workbench UI** — add view/edit modal or expandable panel, supplier lifecycle lock, admin candidate selection, and clear submitted/awarded states.
- [x] **Correction transaction** — keep supplier submission open/unexpired only; add a separate admin correction RPC that replaces the current snapshot, preserves bilateral value, and applies post-award stale-pricing hooks.
- [x] **Line-item source model** — add explicit target/source/canonical-line cost and offered-value snapshots, scope, state, and version markers.
- [x] **Build selling price workflow** — add privately eligible source query, editable source quantities, exact coverage validation, target adjustments, deterministic line allocation, margin calculation, confirmation, reload, and stale-source warnings.
- [x] **Role-safe projections** — manager/admin receive private cost and margin; downstream parties receive only confirmed offered line values and total; suppliers never receive competitors.
- [x] **Spine image designation** — add spine-level designation rows without moving files; update upload/screenshot/default/remove/list behavior and Projects thumbnail projection.
- [x] **Automated tests** — execute database/RPC authorization, award lock, admin correction, aggregation/rounding, direction/privacy, overlap/coverage/staleness, cross-spine/currency rejection, overflow/null input, and spine-image access/migration cases.
- [x] **UI acceptance pass** — validate the live admin workflow and deterministic 11-actor role matrix; verify reload persistence and sibling-leg gallery parity.
- [x] **Migration/deployment gate** — replay the full migration chain in isolation, run complete Projects/type-check gates, apply staging schema, then deploy after review passes.

## Acceptance Criteria

- Given a submitted quotation, when its supplier, RFQ manager, or platform admin opens it, then authorized users see the full structured quotation and unauthorized candidates see nothing.
- Given an awarded quotation, when its supplier opens it, then it is visible and read-only.
- Given any quotation, when platform admin edits it, then the current values are replaced, totals are server-recalculated, update metadata identifies the editor, and affected downstream commercial snapshots are marked stale.
- Given a spine with multiple specification lines, when independent sourcing legs request different subsets, then each supplier sees and prices only its leg's selected subset.
- Given two awarded sourcing legs cover different required lines, when a trader builds and confirms the target selling price, then the target contains one cumulative purchase-cost snapshot, one trader margin, and line-level offered values traceable to both sources.
- Given another trader downstream, when it uses the confirmed selling leg as a source, then it can add its own private margin without seeing the prior trader's supplier costs or margin.
- Given a buyer-facing full-project offer with missing line coverage, when the manager attempts to mark it complete, then the action is blocked and missing quantities are identified.
- Given any authorized leg in a spine, when it opens, then the same ordered set of up to three project images appears; changing the default in one leg changes it everywhere.

## Verification Plan

**Automated:**

- `pnpm --filter portal test:timber-mvp-gate`
- `pnpm type-check`
- focused migration contract tests for every new table/RPC/RLS policy
- `git diff --check`

**Manual local UI:**

1. Create a spine with at least three specification lines.
2. Create two supplier legs with disjoint and then deliberately overlapping partial quantities.
3. Submit quotations as two different suppliers; confirm each sees only its own work package and quotation.
4. Inspect both as trader/admin, award them, verify supplier lock, then perform an admin correction with a reason.
5. Build a cumulative target offer, apply margin, verify buyer-safe projection, reload, then change a source and confirm the stale warning.
6. Upload/capture three images from one leg; verify identical gallery/default thumbnail from every sibling leg and Projects list.
7. Repeat visibility checks as buyer, trader 1, trader 2, both suppliers, platform admin, and unrelated user.

## Approved MVP Defaults

- Buyer-facing offers may contain an intentional subset when explicitly labelled `Partial offer`; `Full offer` requires exact target-line coverage.
- Target-leg additional costs use one total adjustment and are allocated deterministically across offered lines.

## Spec Change Log

- 2026-08-29 review loop 1 — Rejected the first implementation because it exposed unrelated upstream identities/costs, lacked line-level offered-value snapshots and full/partial coverage semantics, accepted unsafe null/currency/stale inputs, and moved ordinary files between leg workspaces. Amended the technical plan with seller-owned source direction, exact role checks, deterministic per-line allocation, explicit scope/coverage, sorted locks/version checks, and a designation-only spine gallery. KEEP: persistent quotation viewing, supplier lock after award, admin current-snapshot correction without history, stale propagation, explicit source selection, and shared three-image UX.

## Suggested Review Order

**Commercial boundary and data model**

- Start with the atomic schema, source direction, coverage, staleness, and spine gallery design.
  [`20260829130000_project_quotation_rollup_spine_gallery.sql:1`](../../supabase/migrations/20260829130000_project_quotation_rollup_spine_gallery.sql#L1)

- Review server-side privacy projection and canonical reload behavior.
  [`projectCommercialActions.ts:17`](../../apps/portal/src/features/projects/actions/projectCommercialActions.ts#L17)

- Check deterministic cent allocation before reviewing UI totals.
  [`projectCommercialRollup.ts:1`](../../apps/portal/src/features/projects/services/projectCommercialRollup.ts#L1)

**Quotation workbench**

- Inspect admin correction and safe error mapping at the action boundary.
  [`projectRfqActions.ts:84`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L84)

- Review persistent quotation detail, editing, award lock, and margin presentation.
  [`ProjectRfqCard.tsx:138`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L138)

**Selling offer workflow**

- Verify explicit source selection, exact-coverage feedback, margin preview, and confirmation.
  [`ProjectCommercialRollup.tsx:9`](../../apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx#L9)

**Spine images**

- Confirm sibling legs load the same authorized designations without exposing storage paths.
  [`getProject.ts:112`](../../apps/portal/src/features/projects/actions/getProject.ts#L112)

- Confirm project-list thumbnails resolve from the same spine designation.
  [`getProjects.ts:84`](../../apps/portal/src/features/projects/actions/getProjects.ts#L84)

**Verification**

- Review commercial arithmetic and boundary cases.
  [`projectCommercialRollup.test.ts:1`](../../apps/portal/src/features/projects/services/__tests__/projectCommercialRollup.test.ts#L1)

- Review migration, privacy, correction, and UI contract assertions.
  [`projectRfq.test.ts:111`](../../apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts#L111)
