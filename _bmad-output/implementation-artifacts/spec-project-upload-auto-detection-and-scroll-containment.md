---
title: 'Project upload auto-detection and scroll containment'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: '850e174808840c753f898300f9ce89ebc9ce3342'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The portal can scroll both the document and its inner content area, allowing the fixed-height shell to move partly off-screen. ZIP extraction also requires a separate picker and is unavailable during new-project creation, where ZIPs are stored unchanged.

**Approach:** Constrain scrolling to the portal content area, route ZIPs chosen or dropped through the existing extraction pipeline automatically, and retain a separate folder picker because browsers require folder-selection mode.

## Boundaries & Constraints

**Always:** Keep the existing 100 MB upload limit and archive safety limits; preserve ordinary-file and folder paths; treat `.zip` files selected through the file picker or drag-and-drop as archives; show upload/extraction progress and recoverable errors; support ZIP extraction both before project creation and in an existing project.

**Ask First:** Any change to archive limits, accepted archive formats, storage model, or deployment to staging.

**Never:** Add client-side archive extraction; introduce a third archive button; silently discard a failed archive; deploy this wave without a separate user request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ordinary selection | One or more non-ZIP files | Files use the normal upload path | Existing per-file errors remain visible and retryable |
| ZIP selection | One or more `.zip` files | Each archive is extracted server-side and its internal folders are created | Failed archive remains visible and retryable |
| Mixed selection | Ordinary files and ZIPs together | Ordinary files upload normally; ZIPs extract sequentially | Failures do not prevent successful items from completing |
| Folder selection | Browser folder picker | Relative paths are retained | Existing validation applies; embedded ZIPs remain files to preserve selected folder semantics |
| Long project page | Content exceeds viewport | Only the portal main area scrolls; sidebar and shell remain within viewport | No document-level scroll is created |

</frozen-after-approval>

## Code Map

- `apps/portal/src/app/layout.tsx` -- root viewport containment.
- `apps/portal/src/app/(portal)/layout.tsx` -- portal flex and main scroll boundary.
- `apps/portal/src/features/projects/components/ProjectDropSurface.tsx` -- unified file/ZIP routing and two-button UI.
- `apps/portal/src/features/projects/components/ProjectCreateView.tsx` -- staged archive extraction after project creation.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- sequential archive handling in an existing project.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- structural regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] Contain document scrolling and keep the portal main area independently scrollable.
- [x] Replace the separate archive picker with automatic ZIP routing from file selection and drag/drop.
- [x] Add archive staging, progress, extraction, failure display, and retry to new-project creation.
- [x] Support mixed and multiple archive uploads in an existing project.
- [x] Update automated regression coverage and verify the local UI.

**Acceptance Criteria:**
- Given any portal page, when its content exceeds the viewport, then the document remains fixed and only the main content area scrolls.
- Given a ZIP selected with Choose files or dropped, when the upload runs, then it is extracted into project folders and the ZIP itself is not stored as the project file.
- Given a new project with a staged ZIP, when project creation completes, then extraction runs with visible progress and can be retried after failure.
- Given the upload surface, then only Choose files and Choose folder controls are shown.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- expected: project workspace regression tests pass.
- `pnpm --filter @timber/portal build` -- expected: production build succeeds.

**Manual checks:**
- Confirm document scroll remains zero while the portal main area can scroll.
- Confirm the upload surface has two buttons and a ZIP is routed to extraction in both new and existing projects.

## Suggested Review Order

**Upload routing**

- The shared surface partitions ordinary files and ZIPs behind two visible controls.
  [`ProjectDropSurface.tsx:24`](../../apps/portal/src/features/projects/components/ProjectDropSurface.tsx#L24)

- New-project staging preserves archive paths, progress, failures, and retry.
  [`ProjectCreateView.tsx:88`](../../apps/portal/src/features/projects/components/ProjectCreateView.tsx#L88)

- Existing projects extract multiple archives sequentially and retain retryable failures.
  [`ProjectFileWorkspace.tsx:205`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L205)

**Scroll containment**

- The fixed portal shell leaves vertical scrolling exclusively to its main region.
  [`layout.tsx:12`](../../apps/portal/src/app/(portal)/layout.tsx#L12)

**Regression evidence**

- Structural guards cover routing, extraction availability, retries, and shell containment.
  [`projects-workspace.test.ts:194`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L194)
