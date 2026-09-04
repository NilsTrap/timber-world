---
title: 'Buyer offer publication and decision'
type: 'feature'
created: '2026-09-04'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '88c68156e4e8bbabe1e73f0c481dfcb8b04d712d'
context:
  - '../project-context.md'
  - 'spec-project-quotation-workbench-commercial-rollup-spine-images.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Awarded supplier quotations can feed the buyer-facing commercial roll-up, but the current “Confirm selling price” action immediately exposes the result to the buyer. There is no explicit trader publication step, buyer acceptance or rejection, or automatic confirmation of the awarded supplier leg.

**Approach:** Keep margin creation on the first buyer–trader leg. Let its trader or platform admin save a private buyer-offer draft, explicitly publish it, and let the buyer accept or reject it with optional notes. Acceptance confirms the buyer leg and every awarded supplier source used by that offer.

## Boundaries & Constraints

**Always:** The buyer sees only published offer quantities, line values, final total, and public offer notes; purchase costs, supplier identities, source quotations, adjustments, and margins remain private. Saving a margin produces a private draft, publication is explicit, and buyer decisions are server-authorized and timestamped. Rejection notes are optional. Source changes make an unaccepted offer stale and require trader review before publication. Whole-project cancellation remains available only through the existing trader/platform-admin project cancellation flow.

**Ask First:** Supporting multiple trader layers beyond preserving the existing directional roll-up; changing an already accepted offer; adding negotiation, withdrawal, expiry, notifications, or document generation.

**Never:** Publish on draft save, let a supplier or unrelated party view or decide the buyer offer, expose private pricing inputs to the buyer, create offer revisions/history for this MVP, or interpret buyer rejection as whole-project cancellation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Draft | Awarded supplier source and valid margin | Trader saves a private offer draft on the buyer–trader leg | Invalid coverage or price is rejected atomically |
| Publish | Valid non-stale draft | Offer becomes buyer-visible and buyer leg becomes awaiting buyer decision | Missing/stale draft cannot publish |
| Accept | Published offer, authenticated buyer | Offer becomes accepted; buyer leg and all referenced awarded supplier legs become confirmed | Repeat or unauthorized decision is rejected without mutation |
| Reject | Published offer with optional notes | Offer becomes rejected and remains visible to buyer and trader; supplier legs remain awarded | Notes over limit or conflicting decision is rejected |
| Source changes | Published but unaccepted offer | Offer becomes stale and buyer can no longer decide until trader reviews and republishes | Existing stored amounts are not silently recalculated |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260829130000_project_quotation_rollup_spine_gallery.sql` -- current commercial source direction, snapshot persistence, privacy boundary, and `draft|confirmed|stale` state constraint to extend additively.
- `supabase/migrations/20260829004000_project_stage_automation.sql` and `supabase/migrations/20260828100000_project_stages.sql` -- existing RFQ/award automation and configurable role-visible lifecycle stages.
- `apps/portal/src/features/projects/actions/projectCommercialActions.ts` -- current private/buyer-safe projection and draft-save action; add publish and buyer-decision actions here.
- `apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx` -- existing first-leg source selection and margin UI; split Save draft from Publish and render buyer decision controls.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- contains the obsolete sourcing-leg `TraderMarginCard`; remove that duplicate workflow.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- currently projects legacy awarded-leg margin data; remove UI dependency without weakening quotation award behavior.
- `apps/portal/src/features/projects/services/__tests__/projectCommercialRollup.test.ts` -- commercial calculations and state-transition coverage.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` and `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- migration, privacy, role, UI-position, and lifecycle contract tests.

## Tasks & Acceptance

**Execution:**
- [x] Add an additive Supabase migration for commercial states `draft`, `published`, `accepted`, `rejected`, and `stale`, publication/decision audit fields, optional buyer notes, and transactional publish/accept/reject RPCs.
- [x] Update the commercial projection/actions so traders/admins receive private draft controls, buyers receive only published buyer-safe values, and only the buyer organisation can accept or reject.
- [x] Update the commercial-offer UI with Save draft, Publish to buyer, buyer Accept/Reject controls, optional notes, and clear state summaries.
- [x] Remove the duplicate awarded supplier-leg margin editor while keeping supplier quotation view/award/edit behavior intact.
- [x] Add project stages for Preparing buyer offer, Awaiting buyer decision, Offer accepted, and Offer rejected, with automatic transitions from the commercial RPCs.
- [x] Add migration and UI contract tests for permissions, privacy, stale offers, optional notes, idempotency/conflicts, and automatic source-leg confirmation.

**Acceptance Criteria:**
- Given an awarded supplier quotation, when the trader opens the first buyer–trader leg, then it can build and save a private commercial offer from that source.
- Given a saved draft, when the trader publishes it, then the buyer sees the final offer without any supplier cost or margin data.
- Given a published offer, when the buyer accepts it, then the offer, buyer leg, and referenced supplier legs become confirmed atomically.
- Given a published offer, when the buyer rejects it with or without notes, then the trader sees the rejection and supplier legs remain awarded.
- Given any other role or leg, when it attempts a commercial mutation directly, then the server denies it without changing state.

## Spec Change Log

## Design Notes

`commercial_rollup_state` is the single MVP offer state. Saving calculations sets `draft`; publishing sets `published`; the buyer sets `accepted` or `rejected`. No version table is introduced. A rejected offer may be edited back into a new draft because only the current snapshot is retained.

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- all Projects, RFQ, commercial, role, and UI contract assertions pass.
- `pnpm --filter @timber/portal exec tsc --noEmit --pretty false` -- portal type-check passes.
- `git diff --check` -- no malformed patch content.

**Manual checks:**
- Browser-test trader save/publish, buyer visibility/privacy and accept/reject, supplier automatic confirmation, rejected-source preservation, reload persistence, and platform-admin parity on the local frontend connected to the configured shared database.
