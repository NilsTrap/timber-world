---
title: 'Project detail spine navigation and compact images'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_commit: '659ef17b627ea0396634fcc900e69fdf39c7a213'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail header mixes spine and leg identity, leg navigation is hidden in a dropdown, the spine title cannot be corrected, and the images area and generated screenshot paths expose unnecessary UI and identifiers.

**Approach:** Treat the title and images as spine-level information, expose ordered leg IDs as compact links, authorize inline title edits for the spine creator or platform admin, and store generated captures under a clean `Screenshots` folder using timestamp-only names.

## Boundaries & Constraints

**Always:** Keep one shared spine title and image gallery across every leg; enforce title authorization on the server; preserve chronological leg ordering; keep screenshot storage-object uniqueness internal while showing a readable timestamp filename; retain the existing three-image limit, default-image controls, preview, and removal rules.

**Ask First:** Any expansion of title editing beyond the spine creator and platform admin; any deployment or production migration.

**Never:** Expose UUIDs in screenshot filenames or leg labels; duplicate titles per leg; weaken file, spine, or organisation access controls; change quotation, specification, party, or project-list behavior in this wave.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Screenshot capture | Preview capture succeeds | Upload `Screenshots/Screenshot <timestamp>.png`, designate it as the next spine image, and refresh the file/gallery UI | Preserve existing cleanup of a partly uploaded file and show the current actionable error |
| Screenshot collision | Two captures resolve to an existing visible path | Retry with a higher-resolution timestamp or deterministic suffix without exposing a UUID | Report failure only after bounded retry |
| Leg navigation | Spine has multiple active legs | Render ordered clickable leg-ID links and visibly mark the current leg | Cancelled current leg remains visible; inaccessible siblings are never serialized |
| Title edit | Viewer is creator or platform admin | Inline edit updates `spines.title`; every leg and spine list row reflects it | Reject blank/oversized values and stale or unauthorized requests |
| Images present | At least one image | Render compact `Images` label, upload control when allowed, and gallery without collapsible/count/explanation chrome | Existing image actions continue to report errors via toast |
| Images absent | No image | Keep a compact collapsed Images entry so the allowed user can open it and upload | Non-managers see no upload action |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/getProject.ts` -- loads spine title, creator capability, and ordered visible leg options.
- `apps/portal/src/features/projects/components/ProjectDetailView.tsx` -- composes editable title, right-side spine ID/status, leg links, parties, and gallery.
- `apps/portal/src/features/projects/components/ProjectLegSelector.tsx` -- replace select control with accessible active-link navigation.
- `apps/portal/src/features/projects/components/ProjectOfficialImages.tsx` -- compact present/empty gallery treatments.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- clean screenshot folder and filename behavior.
- `apps/portal/src/features/projects/actions/projectSpineActions.ts` -- validated title mutation and revalidation.
- `supabase/migrations/20260829*_project_spine_title_edit.sql` -- creator/admin-authorized spine title RPC.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- structural regressions for navigation, header, gallery, screenshot paths, and title permissions.

## Tasks & Acceptance

**Execution:**
- [x] Add a validated spine-title update action and database authorization boundary; load spine title/capability into the detail payload.
- [x] Replace dropdown navigation with ordered leg links and restructure the header so title stands alone while small Spine ID appears above status.
- [x] Add inline title editing for authorized viewers and refresh all same-spine routes plus the project list.
- [x] Save captures under `Screenshots` with readable timestamp names and no UUID in the visible path.
- [x] Simplify the images UI according to present/empty state without regressing gallery actions.
- [x] Update focused automated tests and run local browser acceptance tests.

**Acceptance Criteria:**
- Given any two legs of one spine, when either is opened, then both show the same spine title and gallery.
- Given ordered legs, when a user selects a leg link, then that leg opens and only its ID is highlighted.
- Given an unauthorized viewer, when the title is displayed, then no edit affordance exists and direct mutation is rejected.
- Given a successful capture, when files are inspected, then a `Screenshots` folder contains a readable timestamped PNG with no UUID in its filename.

## Spec Change Log

## Design Notes

The storage layer already prefixes object keys with an internal UUID, so visible `file_name` and `relative_path` can remain readable without sacrificing uniqueness. `spines.title` already exists and is the canonical shared field; the implementation should project it into detail/list views instead of copying edits to individual order names.

## Verification

**Commands:**
- `pnpm --filter portal test:timber-mvp-gate` -- project workspace assertions pass.
- `pnpm type-check` -- strict TypeScript passes.
- `git diff --check` -- no whitespace errors.

**Manual checks (if no CLI):**
- As platform admin, edit the title and navigate across leg links; title, Spine ID placement, active link, and shared images remain correct.
- Capture a preview, confirm the file appears under Screenshots with a readable timestamp name, then confirm the gallery uses the compact populated state.

## Suggested Review Order

**Detail composition**

- Start here to see the redesigned identity, status, navigation, parties, and shared images flow.
  [`ProjectDetailView.tsx:63`](../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L63)

- Ordered accessible links replace the opaque leg selector while preserving active-leg context.
  [`ProjectLegSelector.tsx:5`](../../apps/portal/src/features/projects/components/ProjectLegSelector.tsx#L5)

**Shared spine title**

- Inline editing keeps a compare-and-swap token and resynchronizes safely after refreshes.
  [`ProjectSpineTitle.tsx:9`](../../apps/portal/src/features/projects/components/ProjectSpineTitle.tsx#L9)

- Server mutation validates input and invalidates every same-spine route plus the project list.
  [`projectSpineActions.ts:15`](../../apps/portal/src/features/projects/actions/projectSpineActions.ts#L15)

- Database authorization, access checks, locking, and stale-title rejection protect canonical titles.
  [`20260830090000_project_spine_title_edit.sql:1`](../../supabase/migrations/20260830090000_project_spine_title_edit.sql#L1)

- Detail loading projects canonical title, creator capability, and visible sibling legs.
  [`getProject.ts:133`](../../apps/portal/src/features/projects/actions/getProject.ts#L133)

**Images and screenshots**

- Populated galleries use compact chrome while empty galleries remain collapsed and actionable.
  [`ProjectOfficialImages.tsx:110`](../../apps/portal/src/features/projects/components/ProjectOfficialImages.tsx#L110)

- Captures use readable timestamp paths with bounded collision retries and cleanup.
  [`ProjectFileWorkspace.tsx:359`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L359)

**Regression coverage**

- Structural tests lock navigation, title permissions, compact gallery, and screenshot behavior.
  [`projects-workspace.test.ts:219`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L219)
