---
title: 'Project Detail Collapsible Workflow Cards'
type: 'feature'
created: '2026-08-30'
status: 'done'
baseline_commit: '5ab3267645df600309630271d9eb3ce97d46fd1b'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail page exposes large Terms, Commercial offer, and Files sections at once, uses inconsistent card treatments, and leaves users on the new-project upload screen after successful creation. Header actions are also positioned inconsistently.

**Approach:** Give the workflow sections a consistent bordered-card presentation with useful collapsed summaries and explicit actions, while preserving their current permissions and business logic. After a completely successful project creation and upload sequence, navigate directly to the newly created origin leg.

## Boundaries & Constraints

**Always:** Terms and Commercial offer start collapsed. Empty Terms shows `Set terms`, which expands the card. Commercial offer shows `Configure offer` while collapsed and, when values exist, shows buyer total plus margin amount and percentage in its header. Files uses the same card visual language and may collapse while always showing its file count. In Images, `Upload images` sits immediately left of the expand/collapse chevron. Successful project creation opens the returned first-leg project automatically. Existing permissions, autosave, offer calculations, uploads, file actions, and error handling remain intact.

**Ask First:** Any database/schema change, new pricing calculation, permission change, or redirect after a partially failed folder/file upload.

**Never:** Deploy or push; change commercial formulas; hide errors or incomplete upload results; add new workflow statuses; make Files collapsed by default unless needed to avoid a concrete layout regression.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty terms | No terms configured | Card starts collapsed; `Set terms` expands it | Existing save errors remain visible/toasted |
| Existing terms | One or more terms configured | Card starts collapsed with current summary | Preserve existing values and autosave |
| Draft offer | No confirmed selling price | Card starts collapsed with status and `Configure offer` | Loading and fetch errors remain visible |
| Configured offer | Buyer total/margin available | Header shows total, margin EUR, and margin percentage | Stale/incomplete warnings remain in expanded body |
| Files | Any file count | Consistent card; count visible collapsed; actions available expanded | Preserve upload/action failure behavior |
| Project creation succeeds | Project, folders, and files save successfully | Replace creation screen with first-leg project route | N/A |
| Creation partially fails | Any folder/file save fails | Stay on creation screen with failure summary | Do not redirect automatically |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectTermsCard.tsx` -- controlled Terms disclosure and summary.
- `apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx` -- commercial offer loading, calculation form, and summary values.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- complete file workspace and upload/actions header.
- `apps/portal/src/features/projects/components/ProjectOfficialImages.tsx` -- Images disclosure and header controls.
- `apps/portal/src/features/projects/components/ProjectCreateView.tsx` -- project creation, folder/file upload sequence, and completion state.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- project detail/create source-contract checks.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` -- commercial offer source-contract checks.

## Tasks & Acceptance

**Execution:**
- [x] `ProjectTermsCard.tsx` -- default closed and add a `Set terms` affordance for empty collapsed state.
- [x] `ProjectCommercialRollup.tsx` -- introduce a default-closed disclosure with configure action and always-visible commercial summary.
- [x] `ProjectFileWorkspace.tsx` -- wrap the workspace in a matching bordered card with a collapsible body and persistent file count.
- [x] `ProjectOfficialImages.tsx` -- order header controls as upload then chevron without changing upload permissions.
- [x] `ProjectCreateView.tsx` -- replace the successful completion screen with navigation to the returned first-leg route; retain partial-failure recovery.
- [x] Project tests -- cover default disclosure states, header actions/summaries, and success-only navigation.

**Acceptance Criteria:**
- Given a project detail page, when it loads, then Terms and Commercial offer are collapsed while Files remains usable and visually consistent.
- Given a configured commercial offer, when collapsed, then its buyer total and margin in EUR and percent remain visible.
- Given a newly created project whose folders/files all save, when creation completes, then the browser opens `/projects/{firstLegId}` automatically.
- Given any creation upload failure, when processing ends, then the user remains on the creation page and sees the failure result.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `pnpm test:timber-mvp-gate` -- expected: all project MVP gates pass.

**Manual checks (if no CLI):**
- Exercise collapsed/expanded Terms, Commercial offer, Images, and Files on localhost.
- Create a small test project without uploads and confirm immediate first-leg navigation.

## Suggested Review Order

**Workflow cards**

- Start with the commercial summary and permission-preserving default-closed disclosure.
  [`ProjectCommercialRollup.tsx:119`](../../../apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx#L119)

- Verify empty Terms exposes its action while preserving inline autosave.
  [`ProjectTermsCard.tsx:87`](../../../apps/portal/src/features/projects/components/ProjectTermsCard.tsx#L87)

- Confirm Files remains open initially and blocks collapse during active work.
  [`ProjectFileWorkspace.tsx:578`](../../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L578)

- Check Images uses one card and places upload directly before the chevron.
  [`ProjectOfficialImages.tsx:209`](../../../apps/portal/src/features/projects/components/ProjectOfficialImages.tsx#L209)

**Creation completion**

- Redirect only after verified completion with no sticky save failure.
  [`ProjectCreateView.tsx:254`](../../../apps/portal/src/features/projects/components/ProjectCreateView.tsx#L254)

**Tests**

- Contracts cover disclosures, action ordering, and failure-safe navigation.
  [`projects-workspace.test.ts:335`](../../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L335)

- Commercial contracts preserve calculations while checking the collapsed summary.
  [`projectRfq.test.ts:335`](../../../apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts#L335)
