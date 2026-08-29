# Investigation: Nilitto MVP gap audit

## Hand-off Brief

1. **What happened.** The user requested a fresh comparison of Nils's authoritative MVP specification against the current implementation to identify remaining functionality.
2. **Where the case stands.** Concluded; the ten-point build summary in Nils's v1.0 specification was checked against the current Projects workflow and supporting Orders services.
3. **What's needed next.** Prioritise the four MVP blockers: document workflow integration, AI intake, transport pack automation, and spine/lifecycle completion.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-08-29 |
| Status | Concluded |
| System | Nilitto Trading Platform; `feature/timber-spec-phase`; local repository and local portal |
| Evidence sources | Authoritative specification PDF, current deal-model docs, Git history, migrations, source, tests, local browser |

## Problem Statement

"Read once again Nils MVP document and let me know by the morning what functionality and features are still missing that we have not yet implemented for the MVP."

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `docs/Timber_World_Trading_Platform_Specification.pdf` | Available | Named as authoritative product specification by onboarding. |
| `docs/nils-agent-onboarding.md` | Available | Defines source priority and current deal invariants. |
| `docs/wave2-spine-lego.md` | Available | Current bilateral spine/leg model; supersedes older conflicting deal docs. |
| `docs/spec-alignment-wave.md` | Available | Historical reconciliation and deferred work. |
| Current source and migrations | Available | Must be checked rather than inferred from documentation claims. |
| Role-based browser verification | Partial | Existing local test users available; full role sweep not yet run for this audit. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Extract §-numbered MVP requirements from the PDF | High | Open | Build the authoritative checklist. |
| 2 | Reconcile requirements with current spine/leg model | High | Open | Use wave2 only where it explicitly supersedes older design. |
| 3 | Map every requirement to source, migration, and test evidence | High | Open | Classify implemented, partial, missing, or intentionally deferred. |
| 4 | Validate high-risk role/access and end-to-end gaps in local UI | Medium | Open | Test only where static evidence is insufficient. |
| 5 | Produce prioritized morning report | High | Open | Separate MVP blockers from post-MVP enhancements. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-08-29 | Gap audit requested after current Projects/RFQ development | User request | Confirmed |
| 2026-08-25 | Onboarding reaffirmed the PDF as authoritative and wave2 as the conflict override for deals | `docs/nils-agent-onboarding.md` | Confirmed |

## Confirmed Findings

### Finding 1: The authoritative comparison source is identified

**Evidence:** `docs/nils-agent-onboarding.md:85-91`

**Detail:** The onboarding reading order explicitly names Nils's System Specification v1.0 PDF as the source of truth for product questions and gives `docs/wave2-spine-lego.md` precedence where older deal descriptions conflict.

## Deduced Conclusions

### Deduction 1: Documentation status alone is insufficient

**Based on:** Finding 1 and the user's request for what is actually unimplemented.

**Reasoning:** Historical handoff and alignment documents may describe work as planned or completed; only current source, migrations, tests, and UI can confirm implementation.

**Conclusion:** Every reported gap must cite current implementation evidence, not merely an unchecked roadmap item.

## Hypothesized Paths

### Hypothesis 1: Some MVP requirements remain partially implemented despite broad project coverage

**Status:** Open

**Theory:** Recent Projects work covers spine/legs, RFQs, specifications, files, and stages, while documents, commercial propagation, role-complete workflows, or MCP parity may still be incomplete.

**Supporting indicators:** The repository contains recent local specs and active feature work alongside historical deferred items.

**Would confirm:** Requirement rows with no complete source/migration/test/UI evidence.

**Would refute:** Full evidence coverage for every in-scope PDF requirement after applying the current-model overrides.

**Resolution:** Pending requirement matrix.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Extracted PDF requirement list | Cannot grade coverage | Read/render the authoritative PDF. |
| Current implementation matrix | Cannot distinguish missing from partial | Search source, schema, and test suite per requirement. |
| Role-view runtime evidence | Static checks may miss UI/access failures | Run focused local browser scenarios where needed. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | Not a defect investigation; audit entry point is `docs/Timber_World_Trading_Platform_Specification.pdf`. |
| Trigger | User requests an MVP completeness assessment. |
| Condition | Current feature branch contains ongoing Projects work not yet reconciled into one authoritative coverage matrix. |
| Related files | `docs/nils-agent-onboarding.md`, `docs/wave2-spine-lego.md`, `docs/spec-alignment-wave.md`, `apps/portal/src/features/projects/`, `supabase/migrations/`. |

## Conclusion

**Confidence:** High for the named gaps; Medium for full role-by-role runtime completeness.

The core commercial structure is now credible: bilateral legs, shared spines, catalogue-backed specifications, split sourcing work packages, supplier RFQs, awards, trader margin, configurable stages, files, counterparties, and group-rights foundations exist. The MVP is not yet complete against Nils's v1.0 definition because the current Projects workspace does not expose the document system, AI document ingestion is absent, the one-button logistics pack and AI reply ingestion are absent, and spine split/merge/lot plus gate/cancellation behaviour are not finished end-to-end. Standard catalogue price auto-application and payment records are also explicit specification requirements that remain incomplete.

## Recommended Next Steps

### Fix direction

Not applicable until the audit identifies confirmed gaps.

### Diagnostic

Build a requirement-to-evidence matrix and test only unclear or high-risk paths in the local UI.

## Reproduction Plan

For each MVP requirement: locate source and schema support, identify automated coverage, exercise the relevant role flow locally when static evidence is insufficient, and record the result as implemented, partial, missing, or deferred.

## Side Findings

- The awarded-quotation margin feature is now implemented, migrated, UI-tested, and committed as `3ec1f92`.

## Follow-up: 2026-08-29

### Requirement coverage matrix

| Nils v1.0 requirement | Status | Current evidence | Remaining work |
| --- | --- | --- | --- |
| Counterparties with codes and walled client/supplier access (§11.1) | Substantially implemented | Editable group visibility/actions exist in `apps/portal/src/features/access/components/GroupRightsEditor.tsx:35-67`; Projects party selection uses company records. | Finish role-based UI regression coverage and any remaining record-field gaps. |
| Catalogue and per-item specification fields (§11.2) | Partial | Catalogue snapshots and process fields are visible in Projects; creation copies variant fields in `apps/portal/src/features/projects/actions/projectSpecificationActions.ts:103-162`. | Standard catalogue agreed prices are deliberately blanked (`unit_price_cents: null` at line 146) rather than auto-applied as §5.3 requires. |
| Bilateral deals, directional codes, terms and stages (§11.3) | Substantially implemented | Current Project detail is a two-party leg with spine and leg identifiers: `apps/portal/src/features/projects/components/ProjectDetailView.tsx:57-90`. | Current stage vocabulary is administrator-configurable and differs from the fixed five-stage v1 list; decide whether this is an accepted product override. |
| Spine, split/merge, lot and roll-up (§11.4) | Partial | Schema/services support lineage and split/merge (`apps/portal/src/features/orders/services/spines.ts:313-367`); stage roll-up exists in migrations. | No caller/UI for `splitSpine` or `mergeSpines`; no complete Projects flow for spec-to-lot transition, supply-driven stock spines, or merge fulfilment. |
| Lifecycle gates and chain-break cancellation (§11.5) | Partial/fragmented | A configurable gate manager exists for legacy Orders (`apps/portal/src/features/orders/components/GateConfigManager.tsx:62-127`); Projects stages are configurable by persona. | Projects stage changes do not use the gate engine; cancellation propagation/visible chain-break handling is not complete in the Projects workflow. |
| Deal documents and transport pack (§11.6) | Partial/fragmented | Seven document types, templates, generation services and tests exist under `features/orders/services/documents`. | `ProjectDetailView` renders no document panel (`apps/portal/src/features/projects/components/ProjectDetailView.tsx:61-110`); payment records and the one-button transport pack remain absent. |
| Group-and-rights access model (§11.7) | Substantially implemented | Editable deal visibility, scopes, action rights and field domains are present in `GroupRightsEditor.tsx:35-109`; role/access test suites pass. | Complete real-browser buyer/trader/supplier/accounting/warehouse acceptance sweep for the consolidated Projects experience. |
| AI document handling (§11.8) | Missing from product workflow | Projects supports uploads, previews and deterministic privacy cleanup, but no current action converts an email/PDF/note into structured spec and commercial data. | Build human-reviewed inbound extraction, document generation entry points in Projects, and carrier-reply extraction. |
| Application configurability (§11.9) | Mostly implemented | Products, fields/processes, stages, groups/rights, gates and counterparties have application settings surfaces. | Reconnect the existing gate/document configuration to Projects so settings affect the default workflow. |
| Stage/direction activities as guidance (§11.10) | Partial/fragmented | Guidance exists in legacy Orders (`apps/portal/src/features/orders/components/DealPanel.tsx:565-584`). | Current Projects detail does not render it; port the display-only guidance if Projects remains the canonical workspace. |

### Prioritised remaining MVP work

1. **P0 — Documents inside Projects.** Surface quotation-to-firm specification, proforma, contract, purchase order, packing list, CMR and invoice generation/viewing on each leg; add payment records.
2. **P0 — AI-assisted intake.** Upload/drop email, PDF or notes, extract proposed specification and commercial terms, require human confirmation, then write structured fields.
3. **P0 — Logistics handoff.** One-button transport document pack, recipient/channel handling, and AI-assisted reply-to-transport-field ingestion.
4. **P1 — Spine completion.** Admin split/merge UI, child spine IDs, supply-driven/stock spine creation, and explicit spec-to-lot transition.
5. **P1 — Lifecycle integrity.** Decide the approved stage model, integrate gates with Projects, and finish cancellation/chain-break visibility.
6. **P1 — Pricing completion.** Apply agreed catalogue prices for standard products where configured; connect awarded costs and trader resale values to the correct buyer-facing leg without breaking split sourcing.
7. **P2 — Consolidation and acceptance.** Port stage/direction guidance into Projects and run a complete browser matrix for buyer, two traders, supplier, accounting and warehouse users.

### Refutation pass

- The initial hypothesis that “commercial chain basics may still be missing” is partly refuted: supplier quote entry, award, seller assignment and private trader margin are now working in Projects.
- The hypothesis that documents were wholly unimplemented is refuted: generation infrastructure exists, but it is not integrated into the default Projects workspace, so the user-facing MVP requirement remains partial.
- The user previously asked to skip Docs/MCP temporarily; this report classifies them as remaining against Nils's authoritative MVP, not as regressions in the current development wave.
