---
title: 'Project parties chain builder'
type: 'feature'
created: '2026-08-26'
status: 'done'
context: ['docs/nils-agent-onboarding.md', 'docs/wave2-spine-lego.md', '_bmad-output/project-context.md']
---

<frozen-after-approval reason="user supplied the intended layout and asked implementation to proceed without checkpoints">

## Intent

**Problem:** The Projects detail page shows a flat bilateral party card, so a trader cannot see the commercial chain or assign the buyer and next seller from the project workspace.

**Approach:** Present Buyer - Represented company - Seller as a three-column perspective while preserving the underlying bilateral model. Filling Buyer completes the current draft deal; filling Seller creates a protected purchase leg on the same spine.

## Boundaries & Constraints

**Always:** Validate every mutation server-side; restrict non-admin choices to the represented trader's active trading partners; keep each deal bilateral; copy specification with prices blank to a new seller leg; let existing RLS grant the selected seller access only to that leg.

**Ask First:** Production or staging deployment and push.

**Never:** Add a third party to one order row, expose sibling-chain data outside an accessible leg, share buyer-facing files with a supplier, overwrite locked parties, or use a service-role client.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trader-created draft | Center trader set, buyer empty | Buyer selector lists eligible customers and fills the current draft once | Reject inactive, unrelated, self, non-draft, or already-set choices |
| Buyer-originated project | Buyer already set | Buyer is prefilled and locked | No mutation control is rendered |
| Seller assignment | No purchase leg yet | Trader/supplier selector creates a same-spine purchase leg with center as buyer | Reject unrelated/inactive seller and duplicate assignment |
| Existing seller leg | Accessible purchase leg exists | Seller is prefilled and linked to its protected project | Do not create a duplicate |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/getProject.ts` -- builds the safe party-workspace projection.
- `apps/portal/src/features/projects/actions/projectPartyActions.ts` -- validates and performs buyer/seller assignments.
- `apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx` -- interactive three-column UI.
- `apps/portal/src/features/projects/components/ProjectDetailView.tsx` -- mounts the block.
- `apps/portal/src/features/projects/types.ts` -- serialized allow-list types.

## Tasks & Acceptance

**Execution:**
- [x] Add a safe workspace DTO and loader projection.
- [x] Add buyer completion and seller-leg actions with partner validation.
- [x] Replace the flat cards with the responsive Buyer - You - Seller block.
- [x] Cover projection/action boundaries and run project tests plus type-check.

**Acceptance Criteria:**
- Given a trader-facing sell project, the represented company is centered, buyer is left, and seller is right.
- Given an empty buyer on a draft, selecting a customer fills and locks the current bilateral deal.
- Given no next seller, selecting a trader or supplier creates one same-spine buy leg and RLS makes only that leg accessible to that seller.
- Given an existing buyer or seller, the corresponding card is prefilled and no duplicate mutation is offered.

## Spec Change Log

- Review hardened both mutations with Projects-domain create rights, trader ownership and identity-domain gates; made Seller set-once across active outgoing legs; removed the duplicate Buyer card on purchase-leg views; and made sibling selection deterministic.

## Suggested Review Order

1. `apps/portal/src/features/projects/actions/projectPartyActions.ts`
2. `apps/portal/src/features/projects/actions/getProject.ts`
3. `apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx`

## Design Notes

The visual chain is a perspective over two bilateral records: `Buyer <- current sell deal -> Center` and `Center <- purchase leg -> Seller`. It is not a three-party order.

## Verification

**Commands:**
- `pnpm type-check` -- expected: no TypeScript errors.
- `pnpm test -- --runInBand` -- expected: relevant project/order tests pass.
