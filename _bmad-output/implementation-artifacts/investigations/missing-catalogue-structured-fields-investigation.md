# Investigation: Missing catalogue structured fields

## Hand-off Brief

1. **What happened.** The user reports that a newly added Metal sheets line still expands to the empty structured-fields message.
2. **Where the case stands.** Concluded; localhost and staging share one hosted database and the approved migration was missing there.
3. **What's needed next.** Keep schema migrations synchronized with the shared staging database before local UI acceptance testing.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-08-30 |
| Status | Concluded |
| System | Local Nilitto portal at localhost:3001 |
| Evidence sources | User observation, current source, commit `28b04b8`, local migration state |

## Problem Statement

User reports: “when I add metal sheets and try to expand, it says no additional structured fields for this line.”

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| User UI observation | Available | Exact project ID and visible symptom supplied. |
| Current source | Available | Empty message renders only when both projected groups are empty. |
| Project database row | Available | Repaired row contains 13 basic and 16 process fields. |
| Migration execution state | Available | `20260830110000` applied and recorded on shared staging Supabase. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Inspect exact project line and browser response | High | Done | 13 basic and 16 process fields verified. |
| 2 | Verify migration is applied to the database used by localhost | High | Done | Migration was absent, then applied. |
| 3 | Verify Metal sheets category assignments used by selected variant | High | Done | Backfill produced the expected assigned fields. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-08-30 | Snapshot fix committed locally | commit `28b04b8` | Confirmed |
| 2026-08-30 | User reproduces empty structured fields on a new project | user report | Confirmed |
| 2026-08-30 | Localhost confirmed against staging Supabase `fyzrtqsnmnizoxgcqsjc` | environment configuration | Confirmed |
| 2026-08-30 | Migration applied; exact row repaired to 13 basic and 16 process fields | Management API query | Confirmed |
| 2026-08-30 | Refreshed localhost UI renders process fields instead of empty state | browser DOM | Confirmed |

## Confirmed Findings

### Finding 1: Empty-state rendering requires both structured groups to be absent

**Evidence:** `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx:107`

**Detail:** The displayed message means the project projection supplied neither basic properties nor process requirements.

## Deduced Conclusions

### Deduction 1: This is not merely a collapsed-row presentation issue

**Based on:** Finding 1.

**Reasoning:** The component explicitly checks the projected arrays before showing the message.

**Conclusion:** The missing data originates in creation, storage, or projection.

### Deduction 2: Database deployment drift caused the observed mismatch

**Based on:** The shared database target, absent migration, repaired row, and successful refreshed UI.

**Reasoning:** The old RPC created an empty snapshot; applying the migration backfilled it and immediately changed localhost without a frontend edit.

**Conclusion:** The committed implementation was correct but incomplete operationally until its database migration was applied.

## Hypothesized Paths

### Hypothesis 1: Localhost is using a database without the new migration

**Status:** Confirmed

**Theory:** The frontend commit is running, but the creation RPC is still the prior database implementation that drops blank assignments.

**Supporting indicators:** The migration was prepared but could not be applied because local Supabase was not running.

**Would confirm:** Database function/schema lacks migration `20260830110000_catalogue_assigned_field_snapshots.sql` behavior.

**Would refute:** The exact localhost database shows the migrated RPC and the new row contains assigned snapshots.

**Resolution:** The migration was absent remotely; applying it repaired the exact row and UI.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| None | Root cause confirmed | N/A |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `ProjectSpecificationEditor.tsx:107` |
| Trigger | Expanding a specification line |
| Condition | `basicProperties` and `processRequirements` are both empty |
| Related files | creation action, projection, migration RPC |

## Conclusion

**Confidence:** High

Localhost and staging use the same hosted Supabase project. Migration `20260830110000` had not been applied, so the old creation behavior omitted blank assigned fields. Applying and recording the migration repaired the exact Metal sheets row to 13 basic and 16 process fields, and the refreshed local UI now renders them.

## Recommended Next Steps

### Fix direction

Apply approved schema migrations to the shared staging database before local acceptance testing.

### Diagnostic

No further diagnostic work is required for this incident.

## Reproduction Plan

Open the supplied project, expand Metal sheets, inspect its server payload and corresponding snapshot/process rows.

## Side Findings

- None yet.
