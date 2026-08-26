---
title: 'Project commercial header editing'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: '604510d'
context: ['docs/nils-agent-onboarding.md', 'docs/wave2-spine-lego.md', '_bmad-output/project-context.md']
---

<frozen-after-approval reason="user supplied four direct browser annotations and waived approval checkpoints">

## Intent

**Problem:** The Project commercial header is difficult to correct and configure: seller choices are ungrouped, assigned buyers are locked, the represented trader cannot be changed by a platform admin, a second trader cannot be chained, and terms are read-only cards disconnected from managed reference values.

**Approach:** Turn the Parties and Terms blocks into guarded editing surfaces. Model Buyer ← Trader 1 ← optional Trader 2 ← Manufacturer as sequential bilateral spine legs, allow draft corrections, and reuse the existing catalog-field and deal-term services in a collapsible Terms card.

## Boundaries & Constraints

**Always:** Keep every edge bilateral; validate every party change server-side; allow buyer/trader corrections only while Draft; remint codes after party changes; support Buyer plus up to two sequential Traders plus final Manufacturer/Supplier; group choices as Traders then Suppliers; source Incoterms and Payment terms from active catalog options; derive Advance from Payment terms; persist through existing domain boundaries and RLS.

**Ask First:** Push or deployment to staging/production.

**Never:** Let non-admins change the represented company, let a buyer choice escape the trader's partner book, widen supplier/buyer cross-leg visibility, store a third party on one order, or duplicate reference-data truth in the Projects feature.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Chain picker | Eligible trader and supplier partners | Two labeled groups, Traders first; choosing a trader exposes one more slot | Stop after two traders or a supplier; empty groups omitted |
| Buyer correction | Draft with assigned buyer | Edit control allows another eligible customer and remints code | Non-draft/unauthorized/self choices rejected |
| Trader correction | Platform admin on Draft | Edit control lists active traders and reassigns seller | Non-admin and non-draft calls rejected |
| Terms editing | Viewer can edit deal terms | Collapsible card shows managed Incoterms/Payment dropdowns, delivery date/text, derived Advance | Failed autosave reverts and toasts |
| Read-only terms | Viewer sees but cannot edit | Same card collapses/expands with values only | No mutation controls serialized |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/getProject.ts` -- safe options/capabilities projection.
- `apps/portal/src/features/projects/actions/projectPartyActions.ts` -- draft correction authorization and code reminting.
- `apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx` -- grouped options and edit controls.
- `apps/portal/src/features/projects/components/ProjectTermsCard.tsx` -- collapsible database-backed editor.
- `apps/portal/src/features/orders/actions/getFieldOptions.ts` -- existing managed select values.
- `apps/portal/src/features/orders/actions/dealActions.ts` -- existing terms mutation and advance derivation.

## Tasks & Acceptance

**Execution:**
- [x] Extend party DTO/options with group and edit capabilities.
- [x] Add Draft-only buyer correction and admin-only trader correction.
- [x] Render grouped Seller choices and explicit edit actions.
- [x] Build collapsible Terms card using existing field options/actions.
- [x] Run type-check, security gate, adversarial review, and browser validation.

**Acceptance Criteria:**
- Given mixed candidates, Traders and Suppliers appear in separate labeled groups in that order.
- Given Trader 1 selects Trader 2, a same-spine bilateral leg is created and a final Manufacturer/Supplier slot remains.
- Given two traders already exist, another trader cannot be appended.
- Given an assigned Draft buyer, an authorized trader can click Edit and choose another eligible customer.
- Given a Draft project, only platform admin can edit the represented trader.
- Given managed field options, Terms uses them dynamically and updates Advance from Payment terms.
- Given collapsed Terms, the compact summary remains visible and can be expanded again.

## Spec Change Log

- 2026-08-26: Expanded the bilateral chain to Buyer, two Traders, and final Manufacturer/Supplier.
- 2026-08-26: Added guarded draft corrections, grouped party choices, and database-backed collapsible terms.

## Design Notes

Delivery terms are deprecated in the existing deal domain. The Projects card therefore edits the authoritative Incoterms plus delivery deadline; Advance remains derived from the selected managed Payment term.

The party row is a projection of sequential deals: Buyer buys from Trader 1; Trader 1 buys from optional Trader 2; the last trader buys from the Manufacturer/Supplier. No order row has more than two parties.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check`
- `pnpm --filter @timber/portal test:timber-mvp-gate`

## Suggested Review Order

**Commercial chain model**

- Start with the projection that builds the bounded four-entity spine.
  [`getProject.ts:66`](../../apps/portal/src/features/projects/actions/getProject.ts#L66)

- Review server authorization, traversal, retry, and append rules.
  [`projectPartyActions.ts:10`](../../apps/portal/src/features/projects/actions/projectPartyActions.ts#L10)

- Confirm atomic corrections and the one-outgoing-leg database invariant.
  [`20260826140000_project_party_corrections.sql:1`](../../supabase/migrations/20260826140000_project_party_corrections.sql#L1)

**User interface**

- Inspect the horizontal Buyer–Trader–Trader–Manufacturer editor and grouped selectors.
  [`ProjectPartiesBlock.tsx:13`](../../apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx#L13)

- Inspect collapsible managed terms and serialized optimistic saves.
  [`ProjectTermsCard.tsx:15`](../../apps/portal/src/features/projects/components/ProjectTermsCard.tsx#L15)

- Verify the detail page binds both new commercial blocks.
  [`ProjectDetailView.tsx:26`](../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L26)

**Supporting contracts**

- Review projected party groups, downstream legs, and edit capabilities.
  [`types.ts:73`](../../apps/portal/src/features/projects/types.ts#L73)

- Confirm terms mutations revalidate the matching Project route.
  [`dealActions.ts:271`](../../apps/portal/src/features/orders/actions/dealActions.ts#L271)
