---
title: 'Project detail admin usability'
type: 'bugfix'
created: '2026-08-26'
status: 'done'
baseline_commit: '04909f2888725414b87259f7500e9bd772e7fc4a'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail page spends space on redundant summary metadata, presents the reference more prominently than the project name, uses overly long file-action labels, and restricts a platform administrator's buyer selector to linked trading partners. An assigned buyer is also less direct to change than expected.

**Approach:** Simplify the page hierarchy and controls, make the buyer company name the edit affordance, and let platform administrators select any active customer while retaining linked-partner scoping for ordinary users.

## Boundaries & Constraints

**Always:** Keep project authorization and RLS behavior intact; scope the full customer list to platform administrators; retain draft-only party editing and existing validation; use the existing `organisations.is_customer` customer-book definition; test locally in the real browser.

**Ask First:** Any change to non-admin party visibility, project lifecycle rules, or database schema.

**Never:** Deploy or push to staging; change the selected buyer during browser verification; expose inactive or non-customer organisations as buyers; remove the project status badge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Admin buyer list | Platform admin, draft selling project | Selector contains every active customer except the represented company | Existing loader error behavior remains |
| Scoped buyer list | Non-admin trader | Selector remains limited to linked active customers | Empty list stays non-editable |
| Re-select buyer | Assigned buyer and edit permission | Clicking the company name opens the buyer selector | Cancel preserves current buyer |
| Simplified header | Project with name and reference | Name is primary; reference is secondary; summary row and admin label are absent | Missing name falls back to reference |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/getProject.ts` -- party option loading and platform-admin scope.
- `apps/portal/src/features/projects/actions/projectPartyActions.ts` -- buyer mutation eligibility and partner-link enforcement.
- `apps/portal/src/features/projects/components/ProjectDetailView.tsx` -- page header and redundant summary row.
- `apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx` -- buyer display/edit interaction.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- bulk-action and upload controls.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- project UI source-contract coverage.
- `supabase/migrations/20260826160000_project_admin_buyer_selection.sql` -- admin-only partner-book bypass in the atomic correction boundary.

## Tasks & Acceptance

**Execution:**
- [x] `getProject.ts` and `projectPartyActions.ts` -- bypass partner-link filtering and enforcement for admin buyer choices while preserving customer and active validation.
- [x] `20260826160000_project_admin_buyer_selection.sql` -- preserve the partner-book guard for ordinary users while allowing active-customer corrections by platform admins.
- [x] `ProjectDetailView.tsx` -- remove summary cards/admin text and invert name/reference hierarchy.
- [x] `ProjectPartiesBlock.tsx` -- make an editable assigned buyer name activate the selector with accessible semantics.
- [x] `ProjectFileWorkspace.tsx` -- shorten bulk labels and use the primary button style for Upload files.
- [x] Project tests -- cover admin buyer scope and requested UI strings/interactions.
- [x] Resolve the root selling project for platform admins viewing a purchase leg and route buyer correction to that root without changing non-admin bilateral visibility.

**Acceptance Criteria:**
- Given a platform admin on a draft project, when buyer editing opens, then all active customer organisations are available.
- Given an assigned editable buyer, when its company name is clicked, then the buyer selector opens and can be cancelled without mutation.
- Given the project detail page, when rendered, then the name is the large title, the reference is secondary, and the four summary cards plus role label are absent.
- Given the file toolbar, when rendered, then its actions read Move, Delete, Clean, Share, and Unshare, and Upload files is blue with white text.
- Given localhost UI verification, no browser console or page errors are introduced.

## Spec Change Log

- 2026-08-26: Added the explicitly authorized narrow database-function migration after review found the existing RPC would still reject admin selections outside the trader partner book; retained Draft, active-customer, self-deal, and non-admin partner guards.
- 2026-08-26: Browser verification exposed the commented route as a purchase leg; added admin-only, same-spine, ambiguity- and cycle-safe root resolution plus an explicit buyer correction target.
- 2026-08-26: Read-only database evidence showed legacy upstream pointers are null on all three legs; root resolution now requires exactly one active same-spine non-purchase deal and fails closed otherwise.
- 2026-08-26: Browser evidence showed an admin with a current organisation received viewer-relative `buy` framing; the admin party workspace now uses absolute root seller/buyer roles while non-admin projection stays relative.
- 2026-08-26: Review hardened unresolved admin purchase legs to expose no mutation target and made resolved roots authoritative for downstream traversal, trader counts, append options, and seller mutations.

## Verification

**Commands:**
- Project feature tests and portal type-check -- expected: pass.
- Browser inspection at `http://localhost:3001/projects/09b80dba-0fc3-4222-bbf3-404a4db8fb1a` -- expected: all acceptance criteria visible without staging deployment.

## Suggested Review Order

**Admin buyer projection and safety**

- Resolve purchase-leg views to one root and fail closed on ambiguity.
  [`getProject.ts:42`](../../apps/portal/src/features/projects/actions/getProject.ts#L42)

- Frame admin parties absolutely while preserving ordinary viewer-relative behavior.
  [`getProject.ts:74`](../../apps/portal/src/features/projects/actions/getProject.ts#L74)

- Traverse and extend chains from the resolved root project.
  [`getProject.ts:89`](../../apps/portal/src/features/projects/actions/getProject.ts#L89)

- Load every active customer for admins while retaining partner scoping otherwise.
  [`getProject.ts:172`](../../apps/portal/src/features/projects/actions/getProject.ts#L172)

- Keep application-layer partner enforcement for ordinary users only.
  [`projectPartyActions.ts:30`](../../apps/portal/src/features/projects/actions/projectPartyActions.ts#L30)

- Mirror the narrow admin exception at the atomic database boundary.
  [`20260826160000_project_admin_buyer_selection.sql:25`](../../supabase/migrations/20260826160000_project_admin_buyer_selection.sql#L25)

**Project detail hierarchy**

- Render project name first and remove redundant summary metadata.
  [`ProjectDetailView.tsx:36`](../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L36)

- Bind buyer and seller mutations to their resolved root targets.
  [`ProjectPartiesBlock.tsx:35`](../../apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx#L35)

- Make assigned buyer names accessible re-selection controls.
  [`ProjectPartiesBlock.tsx:52`](../../apps/portal/src/features/projects/components/ProjectPartiesBlock.tsx#L52)

- Use concise bulk labels and prominent primary Upload styling.
  [`ProjectFileWorkspace.tsx:380`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L380)

**Regression coverage**

- Safe nullable mutation targets document root-resolution failure behavior.
  [`types.ts:59`](../../apps/portal/src/features/projects/types.ts#L59)

- Source contracts pin admin isolation, fail-closed guards, hierarchy, and controls.
  [`projects-workspace.test.ts:152`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L152)
