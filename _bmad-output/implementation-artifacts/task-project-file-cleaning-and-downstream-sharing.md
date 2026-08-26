---
title: 'Project file cleaning and downstream sharing'
type: 'feature-task'
created: '2026-08-26'
status: 'awaiting-green-light'
baseline_commit: '99f1a8a'
implementation_authorized: false
context:
  - '_bmad-output/implementation-artifacts/platform/sprint-status.yaml'
  - '_bmad-output/planning-artifacts/platform/architecture.md'
  - '_bmad-output/project-context.md'
  - 'docs/spec-design-notes.md'
---

## Goal

As a trader, I want to create, review, and approve cleaned derivatives of buyer-supplied files, then share only approved derivatives to the next bilateral leg, so that obvious buyer identity is removed while the buyer retains the untouched originals.

## Confirmed Product Rules

- The buyer always sees the original uploaded file unchanged.
- Cleaning creates a derivative; it never overwrites or mutates the original object.
- The trader uses one file list. A cleaned derivative is represented on its source row by a clean-status icon and opens from that icon.
- Clicking the normal file name/row continues to preview the original permitted for that viewer.
- A trader must preview and explicitly approve the cleaned derivative before sharing it.
- Bulk **Share with next party** operates on selected rows and is permitted only when every selected file has an approved cleaned derivative.
- A persistent **Shared** checkbox/state is visible on every file row, not hidden in an actions menu.
- The next party sees only files shared from the immediately previous bilateral leg. It never receives the buyer original or unshared siblings.
- In a multi-trader chain, Trader 2 repeats the same review/share decision for its own next leg; sharing never skips a leg.

## Existing Foundation to Reuse

- `order_files.file_variant` already allows `original | recipient_copy`, and `source_file_id` already links a derivative to its original.
- Project files already use private `orders` storage, signed URLs, bilateral deal RLS, safe client DTOs, a single workspace list, bulk row selection, and preview routing for PDF/HTML/DXF/STEP.
- The legacy Orders feature already has `copyOrderFile` and a `pdf-lib` title-block masking routine. Reuse it where practical, accepting that this prototype relies on human verification rather than a formal privacy guarantee.
- The MVP backlog already describes copying customer files to production with optional PDF logo/title-block removal and per-category thumbnails. This task adapts that intent to bilateral Projects without restoring duplicate category lists.

## Required Data Model

Extend the existing derivative model with the minimum additional state; do not introduce file or policy versioning.

- Original row: `order_id = source leg`, `file_variant = original`, immutable cleaning source.
- Clean derivative row: linked by `source_file_id`, stored separately, never returned as an ordinary file-list row.
- Add a small cleanup lifecycle: `not_started | processing | needs_review | approved | failed`.
- Record generated time, approved time, approving portal user, and a concise findings list/count. Do not expose storage paths in client payloads.
- Store the immediate destination leg on the approved derivative when shared, plus shared time and actor. Unsharing clears that destination. There is no publication-version history in the prototype.
- Database constraints/RLS must guarantee that destination viewers can resolve only approved derivatives shared to their exact bilateral deal.

## Cleaning Pipeline

Cleaning is format-aware and produces a reviewable artifact plus machine findings. This is prototype-grade assistance, not a privacy guarantee; only explicit trader approval changes the status to `approved`.

### Common checks

- Build a sensitive-term dictionary focused on trading anonymity: buyer/customer company names and aliases, project names/references, people names, emails, domains, phone numbers, and user-supplied extra terms.
- Apply straightforward deterministic matching first, then optionally ask an LLM to identify additional owner-identifying content that the fixed list missed.
- Store one admin-editable cleanup system prompt in platform settings. Admins can add instructions such as “also remove bank account numbers”; prompt edits affect future cleanup runs only and are not versioned.
- The LLM returns structured findings/locations. Format-specific code performs the actual removal; the LLM never directly rewrites or approves a file.
- Remove obvious document metadata, comments, external links, scripts/macros, and filename/path leakage where readily supported.
- Scan visible and extractable hidden/metadata text. Findings are for the trader review screen and are not sent downstream.
- Preserve technical geometry, dimensions, manufacturing instructions, page size, and file type when safely possible.

### PDF

- Remove matched text and obvious logo/title-block areas using the existing PDF tooling where possible; use OCR only when needed for scanned/image PDFs.
- Strip readily accessible metadata, annotations, attachments, form values, actions, JavaScript, and external links.
- Re-open and rescan the output before setting `needs_review`; the human preview is the final prototype safeguard.

### HTML

- Parse as an inert document; remove scripts, event handlers, comments, metadata, forms, external resource URLs, and matched buyer-identifying text/attributes.
- Sanitize with the existing server-side HTML sanitization boundary or a maintained sanitizer consistent with OWASP guidance; never regex-clean HTML.
- Preserve a self-contained manufacturing report that remains previewable in the existing sandboxed HTML viewer.

### DXF

- Parse DXF structure, preserving geometry/units while removing matched owner-identifying `TEXT`, `MTEXT`, `ATTRIB`, title-block content, and obvious metadata.
- Validate by reparsing and rendering with the existing DXF viewer. Never perform blind global string replacement that could corrupt group-code structure.

### Other formats

- Unsupported formats use a manual clean-replacement upload linked to the original, followed by preview and approval.

## UX Requirements

- Keep the existing folder tree and one file table.
- Add columns/statuses: **Clean** icon/status and always-visible **Shared** checkbox/state. Preserve the existing selection checkbox for bulk actions.
- Original row/file click previews the original allowed to the current viewer. Clean icon previews the derivative with a clear “Clean preview” label and findings/review status.
- Bulk actions: **Clean selected**, **Share with next party**, and **Unshare selected**. Disable with a concise reason when no next leg exists, processing is incomplete, a derivative is unapproved, or permission is missing.
- Cleaning progress and per-file failures must not discard successful siblings. Retrying is idempotent.
- Sharing confirmation names the immediate destination organisation and reports exactly which files will become visible.
- Destination users see shared files in their normal single file list, with provenance such as “Shared by {previous party}”; they never see source IDs, source paths, findings, or the original-clean toggle.
- Mobile rows expose the same clean/shared state without hiding it inside the overflow menu.

## Authorization and Privacy Boundaries

- Buyer: read/download its original on its own sell-facing project; cannot see trader-only findings or downstream publication state.
- Current trader: may clean/review/approve/share only files visible on its bilateral leg and only to the immediately adjacent downstream leg.
- Next party: may read/download only active published derivatives addressed to its exact deal.
- Platform admin: may administer the same workflow but must still publish leg-by-leg; no direct buyer-to-manufacturer shortcut.
- Server actions must re-resolve actor, source file, source leg, immediate downstream leg, lifecycle, and domain/action rights. Never trust client-supplied destination IDs or cleanup status.
- RLS and storage policies must independently prevent original-object access from a downstream leg. Signed URLs are issued only after resolving the viewer-specific original or published derivative.
- If an external LLM is used, send only the minimum extracted content required, use an approved non-training/zero-retention configuration, and show that dependency clearly in the implementation notes.

## Acceptance Criteria

1. Given a buyer original, cleaning leaves its database row and storage bytes unchanged and creates a linked derivative.
2. The buyer continues to preview/download the original and receives no derivative, findings, approval, or sharing metadata.
3. A trader sees one row with original preview, clean status/icon, clean preview, and an always-visible shared state.
4. A file cannot become shared unless its derivative is `approved`; `processing`, `needs_review`, and `failed` are rejected server-side.
5. Bulk sharing is all-or-nothing for the selected set and targets only the immediate next deal leg.
6. The next party sees exactly the active shared derivatives and no unshared original files from the previous leg.
7. Unsharing immediately removes destination metadata visibility and prevents new signed URLs; already-issued URLs use a short expiry documented in the task implementation.
8. PDF, HTML, and DXF outputs pass format re-open/render checks and a second sensitive-content scan before review.
9. Unsupported file types remain visibly blocked until a manual cleaned replacement is uploaded and approved.
10. Two-trader chains propagate files one leg at a time, with independent approval and sharing decisions at each trader.
11. Role-matrix and real-RLS tests prove that buyer originals cannot be fetched through downstream row queries, RPCs, storage paths, or signed-URL actions.

## Implementation Tasks — Do Not Start Without Green Light

- [ ] Try representative real PDFs, HTML, and DXFs and choose the simplest acceptable cleanup techniques for the prototype.
- [ ] Add minimal cleanup/share fields and RLS, reusing `recipient_copy` and `source_file_id`.
- [ ] Add PDF/HTML/DXF cleaners using deterministic terms plus optional structured LLM findings.
- [ ] Add one admin-editable cleanup prompt and extra sensitive terms setting; no version history.
- [ ] Add server actions/jobs for bulk clean, retry, approve, share, and unshare with adjacency enforcement.
- [ ] Extend safe project file projections so one source row carries clean/shared presentation state without storage paths.
- [ ] Update the single desktop/mobile workspace list and preview dialog.
- [ ] Add unit fixtures for company/customer/project/person names, emails, domains, phones, and optional bank-detail instructions, plus authorization and local browser E2E.
- [ ] Validate locally against the running test project; do not push or deploy until explicitly authorized.

## Test Matrix

- PDF: text layer, scanned page, metadata, logo/title block, buyer names/emails/phones/project references.
- HTML: scripts, handlers, comments, metadata, links, malformed markup, buyer-identifying text.
- DXF: HEADER metadata, TEXT/MTEXT/ATTRIB, title block, units and geometry preservation.
- Workflow: partial batch failure, retry, clean/share approval gate, delete/unshare, no downstream leg, two-trader chain.
- Access: buyer, Trader 1, Trader 2, supplier/manufacturer, unrelated organisation, platform admin; both app actions and direct RLS/storage probes.

## Non-Goals

- No automatic sharing immediately after cleaning.
- No mutation or deletion of buyer originals.
- No full-chain file roll-up in one project payload.
- No formal privacy guarantee or claim that automated cleanup catches everything; human review is expected.
- No file versions, cleanup-policy versions, historical publication ledger, or enterprise compliance workflow.
- No restoration of separate Customer Files / Production Files UI sections.
- No implementation, migration application, staging push, or deployment before explicit green light.

## Relevant Existing Files

- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx`
- `apps/portal/src/features/projects/components/ProjectFilePreview.tsx`
- `apps/portal/src/features/projects/actions/projectFileActions.ts`
- `apps/portal/src/features/projects/actions/_projectFileAccess.ts`
- `apps/portal/src/features/projects/services/projectFiles.ts`
- `apps/portal/src/features/projects/types.ts`
- `apps/portal/src/features/orders/actions/copyOrderFile.ts`
- `supabase/migrations/20260821211500_project_file_workspace.sql`
- `supabase/migrations/20260826090000_project_workspace_folders.sql`
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts`

## Source Notes

- Existing MVP marker: `_bmad-output/implementation-artifacts/platform/sprint-status.yaml` under Orders Feature.
- Current schema intentionally pre-seeds `recipient_copy` and `source_file_id` but current Project loaders select originals only.
- HTML sanitization must follow maintained sanitizer guidance; DXF cleanup must respect Autodesk section/entity structure; PDF attachments/actions/metadata require explicit handling beyond page painting.
