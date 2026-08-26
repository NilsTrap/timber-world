---
title: 'Project file viewers and type icons'
type: 'feature'
created: '2026-08-26T08:58:25+03:00'
status: 'done'
baseline_commit: 'ed3cac89d9fcf73f3bff56cd3c16fef609b33abf'
context:
  - '{project-root}/docs/nils-agent-onboarding.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Project participants can manage uploaded files, but only browser-native PDF and raster-image previews are available, while the common HTML reports, DXF drawings and STEP models in real project folders must be downloaded before they can be checked. File rows also use broad generic icons that do not make engineering formats easy to distinguish.

**Approach:** Add a lazy-loaded, format-aware preview dialog for PDF/images, sanitized HTML, 2D DXF and 3D STEP, and centralize accessible, visually distinct file-type icons for desktop, mobile and pending-upload rows. Keep NC1 download-only.

## Boundaries & Constraints

**Always:** Reuse the existing RLS-authorized signed-URL action; choose a previewer using normalized extension plus MIME type because browser uploads may omit or misreport engineering MIME types; lazy-load heavy DXF/STEP code; isolate uploaded HTML with sanitization and a scriptless sandbox; dispose object URLs, viewer instances, WebGL resources and asynchronous work when the dialog closes; preserve download, rename, delete, folder and permissions behavior; retain an explicit loading, unsupported and recoverable-error state; add accessible labels and non-color-only type identification.

**Ask First:** Adding a server-side conversion service, increasing the 100 MB upload limit, deploying to Vercel staging, or changing storage/database schemas.

**Never:** Preview NC1 in this scope; execute scripts or active content from uploaded HTML; expose raw storage paths or bypass `getProjectFileUrlAction`; load DXF/STEP libraries in the initial project-page bundle; claim rendered engineering geometry is authoritative for manufacturing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Native preview | Ready PDF or supported raster image | Existing signed content opens in the preview dialog | Show retryable preview error without affecting download |
| HTML report | Ready `.html`/`.htm`, including embedded data images | Sanitized report renders in a scriptless sandbox | Block active content; show error and keep download available |
| DXF drawing | Ready `.dxf`, including R12/AC1009 files with sparse MIME metadata | Interactive 2D canvas supports fit, pan, zoom and layer-aware rendering | Unsupported/corrupt entities produce a clear failure state |
| STEP model | Ready `.step`/`.stp`, including AP214 | Interactive 3D viewer supports orbit, zoom and reset/fit | Parser/WebGL failures produce a clear failure state |
| Unsupported file | NC1, archive, office or unknown extension | Distinct icon remains visible; preview action is disabled | Accessible label states preview is unavailable |
| Stale URL | Signed URL expires or fetch fails | Viewer does not retain stale content | Offer retry, which requests a fresh signed URL |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- current file table, actions, preview dialog and generic icon selection.
- `apps/portal/src/features/projects/components/ProjectFilePreview.tsx` -- new viewer dispatcher and shared loading/error shell.
- `apps/portal/src/features/projects/components/projectFileTypes.tsx` -- new centralized extension/MIME classification and icon metadata.
- `apps/portal/src/features/projects/components/viewers/` -- lazy HTML, DXF and STEP viewer components with lifecycle cleanup.
- `apps/portal/src/features/projects/filePaths.ts` -- shared previewability classification used by UI and server action.
- `apps/portal/src/features/projects/actions/projectFileActions.ts` -- existing authorized signed-URL boundary; broaden preview allowlist without weakening authorization.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- regression coverage for preview routing, security boundaries, icons and unsupported formats.
- `apps/portal/package.json` / `pnpm-lock.yaml` -- pinned browser-viewer dependencies (`dxf-viewer`, `occt-import-js`) loaded only on demand.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/components/projectFileTypes.tsx` and `filePaths.ts` -- classify PDF, images, HTML, DXF, STEP, NC1, office, spreadsheet, archive and unknown files from normalized extension/MIME; provide distinct icons and preview capability.
- [x] `apps/portal/src/features/projects/components/ProjectFilePreview.tsx` and `components/viewers/*` -- implement native, sanitized HTML, interactive DXF and interactive STEP views with lazy loading, controls, error handling and cleanup.
- [x] `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` and `actions/projectFileActions.ts` -- route authorized signed URLs into the correct viewer and apply the shared icons everywhere without disturbing workspace operations.
- [x] `apps/portal/package.json`, lockfile and required public/runtime assets -- add pinned, license-compatible viewer runtimes without placing them in the initial page bundle.
- [x] `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- cover extension fallback, NC1 exclusion, action authorization and viewer-security/lazy-load markers.

**Acceptance Criteria:**
- Given a user who can view the project, when they open PDF, image, HTML, DXF or STEP files, then the corresponding preview loads inside the project dialog without granting write access or exposing a permanent URL.
- Given desktop or mobile file rows, when different supported and unsupported file types are listed, then each has a recognizable icon and accessible type label while all existing file-management actions still work.
- Given NC1 or another unsupported format, when its row is rendered, then download remains available and preview remains disabled.

## Spec Change Log

## Design Notes

Use `dxf-viewer` for performant 2D WebGL rendering and `occt-import-js` for local STEP triangulation; initialize both behind dynamic imports. Treat HTML as hostile even when current samples are self-contained: fetch the signed URL, sanitize markup, add a restrictive document policy, and render only through `iframe srcDoc` with an empty sandbox. Keep the existing browser-native PDF/image path unless implementation testing shows it is unreliable.

## Verification

**Commands:**
- `pnpm type-check` -- expected: all workspace type-check tasks pass.
- `cd apps/portal && ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/projects/__tests__/projects-workspace.test.ts` -- expected: all workspace, preview routing and authorization assertions pass.
- `pnpm --filter @timber/portal build` -- expected: production build succeeds and heavy viewer modules are emitted as lazy chunks.

**Manual checks:**
- Run the portal production build locally and inspect representative PDF, embedded-image HTML, R12 DXF and AP214 STEP files; verify controls, error recovery, cleanup on close, mobile icon display and unchanged download/rename/delete behavior.

## Suggested Review Order

**Format and authorization boundary**

- Extension-first classification keeps NC1 download-only despite misleading MIME metadata.
  [`filePaths.ts:27`](../../apps/portal/src/features/projects/filePaths.ts#L27)

- Authorized signing rejects unsupported and oversized interactive previews before issuing URLs.
  [`projectFileActions.ts:324`](../../apps/portal/src/features/projects/actions/projectFileActions.ts#L324)

**Workspace integration and recovery**

- Existing file management gains race-safe preview opening, refreshing, and shared icons.
  [`ProjectFileWorkspace.tsx:261`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L261)

- Lazy dispatcher isolates viewer failures and refreshes expired native preview links.
  [`ProjectFilePreview.tsx:14`](../../apps/portal/src/features/projects/components/ProjectFilePreview.tsx#L14)

**Hostile and engineering formats**

- HTML reports are sanitized, CSP-constrained, size-capped, and rendered scriptlessly.
  [`sanitizeProjectHtml.ts:5`](../../apps/portal/src/features/projects/components/viewers/sanitizeProjectHtml.ts#L5)

- DXF parsing runs in a worker with timeouts, layer controls, and immediate cleanup.
  [`DxfFileViewer.tsx:18`](../../apps/portal/src/features/projects/components/viewers/DxfFileViewer.tsx#L18)

- STEP triangulation uses a terminating local worker and validates every mesh.
  [`StepFileViewer.tsx:12`](../../apps/portal/src/features/projects/components/viewers/StepFileViewer.tsx#L12)

- WebGL resources are disposed on failure, retry, or dialog closure.
  [`StepFileViewer.tsx:54`](../../apps/portal/src/features/projects/components/viewers/StepFileViewer.tsx#L54)

**Supporting UI and verification**

- Accessible file-type labels pair distinct icons with centralized classification.
  [`projectFileTypes.tsx:20`](../../apps/portal/src/features/projects/components/projectFileTypes.tsx#L20)

- Behavioral regressions cover sanitizer output, NC1 bypasses, and malformed STEP geometry.
  [`projects-workspace.test.ts:72`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L72)
