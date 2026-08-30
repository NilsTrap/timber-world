---
title: 'Unify project detail visual system'
type: 'refactor'
created: '2026-08-30'
status: 'done'
baseline_commit: 'ceb2f18311889c0d36425f0df8b77e1377aac49b'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail page mixes several card shells, heading levels, backgrounds, radii, button sizes, icon treatments, and disclosure interactions. This makes related sections—including Technical specification—feel like separate interfaces rather than one coherent workflow.

**Approach:** Introduce small project-local section and disclosure primitives, then migrate every top-level project detail section to those primitives. Reuse the existing design tokens and button component while preserving all workflow, permissions, data, and default open/closed behavior.

## Boundaries & Constraints

**Always:** Use semantic theme tokens such as `bg-card`, existing borders, and existing foreground colors; use one rounded card shell, spacing rhythm, heading scale, action-button height, disclosure control, hover treatment, focus treatment, and icon scale across the page. Primary green actions should include a meaningful icon where one exists. Destructive actions remain visually destructive, neutral actions remain neutral, disabled/loading states remain clear, and controls retain accessible labels and usable touch targets. Preserve responsive behavior, role visibility, permissions, and all current business behavior.

**Ask First:** Any change to the application-wide design system outside Projects; any workflow, permission, database, pricing, quotation, upload, or status change; any visual redesign that materially changes information hierarchy rather than normalizing it.

**Never:** Deploy or push as part of this task; make every action green regardless of meaning; remove accessible names, keyboard focus, confirmations, or role restrictions; change formulas, persisted values, API contracts, or default section state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Standard section | Images, Terms, Technical specification, RFQ, Commercial offer, Files, or Notes | Shared card shell, header rhythm, actions, and responsive spacing | Existing empty and error messages remain visible |
| Disclosure | Collapsible section open or closed | One consistent icon button, rotation, hover/focus state, ARIA state, and content association | Disabled collapse cannot toggle |
| Action state | Enabled, disabled, loading, destructive, or read-only action | Same size and icon rhythm while semantic variant remains accurate | Existing validation and disabled reasons remain unchanged |
| Narrow viewport | Project detail on mobile/narrow width | Headers and actions wrap without clipping or hidden content | Long labels wrap or truncate accessibly |
| Restricted role | Buyer, trader, supplier, or admin | Existing controls remain visible or hidden exactly as before | No permission broadening |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSectionCard.tsx` -- shared static and collapsible project-section shells.
- `apps/portal/src/features/projects/ProjectDetailView.tsx` -- page composition, Parties, Notes, and section integration.
- `apps/portal/src/features/projects/ProjectOfficialImages.tsx` -- Images header, actions, and disclosure.
- `apps/portal/src/features/projects/ProjectTermsCard.tsx` -- Terms disclosure and actions.
- `apps/portal/src/features/projects/ProjectSpecificationEditor.tsx` -- Technical specification card shell and action alignment.
- `apps/portal/src/features/projects/ProjectRfqCard.tsx` -- supplier quotation section shell.
- `apps/portal/src/features/projects/ProjectCommercialRollup.tsx` -- Commercial offer disclosure and summary.
- `apps/portal/src/features/projects/ProjectFileWorkspace.tsx` -- Files shell, toolbar, and disclosure.
- `apps/portal/src/features/projects/ProjectPartiesBlock.tsx` -- party-card token alignment.
- `apps/portal/src/features/projects/ProjectLegSelector.tsx` -- semantic pill/background alignment.
- `apps/portal/src/__tests__/projects-workspace.test.tsx` -- project detail visual/interaction regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] Add shared project section primitives with standardized header, subtitle, action slot, disclosure button, spacing, and accessibility behavior.
- [x] Migrate all top-level project sections and the Technical specification table to the shared visual language without altering their logic.
- [x] Normalize project action sizing, icon placement, semantic variants, disabled/loading states, party cards, and leg pills.
- [x] Add regression coverage for disclosure behavior, role visibility, and stable workflows.
- [x] Test desktop and narrow layouts in the local browser and correct visual regressions found.

**Acceptance Criteria:**
- Given the project detail page, when its sections are compared, then they use the same card background, border, radius, header typography, padding rhythm, and action alignment.
- Given Technical specification, when displayed with or without rows, then it reads as the same card family as Terms, Commercial offer, and Files.
- Given a collapsible card, when focused, hovered, expanded, or collapsed, then its disclosure control behaves and looks consistently and exposes correct accessible state.
- Given primary project actions, when rendered, then button height and icon rhythm are consistent; neutral and destructive actions keep their correct semantic styling.
- Given any supported role, when the page loads after the refactor, then permissions and available workflows are unchanged.
- Given desktop and narrow layouts, when the page is scrolled and interacted with, then controls and content do not clip, overlap, or become unreachable.

## Spec Change Log

## Design Notes

The shared primitive is local to the Projects feature so this pass can unify the full page without creating an unapproved application-wide redesign. It should compose the existing `Button` and theme utilities, not duplicate them. Parties may retain their two-column relationship layout, but their inner cards should use the same surface, border, radius, and action sizing.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- expected: full project MVP gate passes.

**Manual checks:**
- Inspect and interact with every project detail section at desktop and narrow viewport sizes, including empty, populated, disabled, and collapsed states.
- Verify buyer, trader, supplier, and super-admin views retain their current action visibility.

## Suggested Review Order

**Shared visual language**

- Defines the common card surface, header rhythm, responsive actions, and body spacing.
  [`ProjectSectionCard.tsx:3`](../../../apps/portal/src/features/projects/components/ProjectSectionCard.tsx#L3)

- Centralizes disclosure sizing, icon treatment, hover behavior, and ARIA state.
  [`ProjectDisclosureButton.tsx:6`](../../../apps/portal/src/features/projects/components/ProjectDisclosureButton.tsx#L6)

**Page-wide adoption**

- Makes Technical specification a first-class member of the shared card family.
  [`ProjectSpecificationEditor.tsx:79`](../../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L79)

- Applies the same structure to Parties and Notes at the page composition boundary.
  [`ProjectDetailView.tsx:68`](../../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L68)

- Unifies Files while preserving active-work collapse protection and upload behavior.
  [`ProjectFileWorkspace.tsx:579`](../../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L579)

- Unifies Images without changing gallery, upload, or deletion workflows.
  [`ProjectOfficialImages.tsx:214`](../../../apps/portal/src/features/projects/components/ProjectOfficialImages.tsx#L214)

- Aligns Terms and Commercial offer action icons and disclosures.
  [`ProjectTermsCard.tsx:93`](../../../apps/portal/src/features/projects/components/ProjectTermsCard.tsx#L93)
  [`ProjectCommercialRollup.tsx:129`](../../../apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx#L129)

**Regression coverage**

- Locks the shared shell, responsive action slot, and disclosure contracts into the MVP gate.
  [`projects-workspace.test.ts:338`](../../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L338)
