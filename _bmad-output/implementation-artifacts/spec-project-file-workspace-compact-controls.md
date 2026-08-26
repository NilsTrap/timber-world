---
title: 'Compact project file workspace controls'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: '903e4adf9dca6e5d04f0b2a5c3bed6bd544e387b'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project file uploader occupies substantial vertical space when it is not in use, while the low-value Folder table column crowds filenames and actions.

**Approach:** Collapse uploading behind an “Upload files” control in the Files header, retain the existing drop surface when expanded, and replace the Folder column with a per-file information action that presents available metadata in a compact dialog.

## Boundaries & Constraints

**Always:** Keep the existing upload, folder tree, preview, download, rename, move, and delete behavior intact. Show the upload control only to users with file-write permission. Start collapsed, expand on click, reset a ten-second idle timeout on interaction, and do not auto-collapse while uploads are active. Present only metadata already available in `ProjectFileMeta`, including the containing folder derived from `relativePath` and `createdAt` labelled as Uploaded.

**Ask First:** Any database/schema change, new metadata field, changed permission rule, or broader project-detail redesign.

**Never:** Push, deploy, alter remote data, invent a modified timestamp, remove the folder navigation tree, or expose storage paths/signed URLs/internal file identifiers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open uploader | Writable viewer clicks “Upload files” | Existing drop surface expands below the header | Existing upload error handling remains unchanged |
| Idle uploader | Expanded with no interaction or active uploads for ten seconds | Surface collapses back to the header button | Timer resets on interaction and pauses while uploads are active |
| Read-only viewer | Viewer cannot write files | No upload control or drop surface is rendered | N/A |
| Inspect file | Viewer clicks the info icon | Compact dialog shows name, folder/path, type, size, status, and uploaded time | Null MIME/size values render a clear fallback |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectDetailView.tsx` -- currently owns the Files section heading; hand it to the stateful workspace.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- owns upload state, file table/actions, responsive rows, and dialogs.
- `apps/portal/src/features/projects/components/ProjectDropSurface.tsx` -- existing upload surface to preserve unchanged unless a small activity hook proves necessary.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- lightweight regression guards for workspace behavior.

## Tasks & Acceptance

**Execution:**
- [x] `ProjectDetailView.tsx` and `ProjectFileWorkspace.tsx` -- co-locate the Files heading and upload-toggle state while preserving the page's existing file-count behavior.
- [x] `ProjectFileWorkspace.tsx` -- remove the desktop Folder column and add accessible info actions/dialog metadata for desktop and mobile.
- [x] `projects-workspace.test.ts` -- add regression guards for the compact uploader and metadata action.

**Acceptance Criteria:**
- Given any existing project workspace, all prior file and folder operations remain available and file names gain the space formerly used by Folder.
- Given a writable viewer, the uploader is collapsed initially and can be reopened after automatic collapse.
- Given a read-only viewer, metadata inspection remains available but upload and editing controls remain absent.

## Spec Change Log

- Review 1: The initial task wording implied a new live file count while the project summary remains server-rendered. The task now preserves existing count behavior, avoiding contradictory totals without expanding this UI refinement into project-wide state synchronization. KEEP: the Files heading action and compact workspace layout.

## Verification

**Commands:**
- `npx --yes pnpm@9.15.4 --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `cd apps/portal && npx --yes tsx src/features/projects/__tests__/projects-workspace.test.ts` -- expected: project workspace regression suite passes.
- `npx --yes pnpm@9.15.4 --filter @timber/portal build` -- expected: production build succeeds.

**Manual checks (if no CLI):**
- Inspect the supplied local project as writable and read-only: toggle/idle-collapse upload, open file information, and confirm the desktop Folder column is absent.

## Suggested Review Order

**Compact upload flow**

- Files heading owns the permission-aware toggle and ten-second idle policy.
  [`ProjectFileWorkspace.tsx:316`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L316)

- Dragging and native file pickers pause idle collapse until interaction finishes.
  [`ProjectDropSurface.tsx:20`](../../apps/portal/src/features/projects/components/ProjectDropSurface.tsx#L20)

**File information**

- Desktop table drops Folder and grants filenames the reclaimed width.
  [`ProjectFileWorkspace.tsx:402`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L402)

- Shared action opens metadata for writable and read-only viewers.
  [`ProjectFileWorkspace.tsx:454`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L454)

- Metadata uses only safe loader fields and labels creation time as Uploaded.
  [`ProjectFileWorkspace.tsx:459`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L459)

**Supporting changes**

- Project detail delegates the complete Files section to its stateful workspace.
  [`ProjectDetailView.tsx:161`](../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L161)

- Regression guards cover collapsed upload, active interaction, and metadata wiring.
  [`projects-workspace.test.ts:147`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L147)
