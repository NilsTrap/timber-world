# Story 10.16: Audit Trail for Impersonation

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** compliance officer,
**I want** all impersonation actions logged,
**So that** there's accountability for Super Admin actions.

## Acceptance Criteria

**Given** Super Admin enters View As mode
**When** the mode activates
**Then** an audit record is created:
- event_type: "impersonation_start"
- actual_user_id: Super Admin's ID
- target_org_id: Org being impersonated
- target_user_id: User being impersonated (if applicable)
- timestamp

**Given** Super Admin performs an action while impersonating
**When** the action executes
**Then** the action's audit record includes:
- impersonation_context: { org_id, user_id }
- actual_user_id: Super Admin's ID

**Given** Super Admin exits View As mode
**When** the mode deactivates
**Then** an audit record is created:
- event_type: "impersonation_end"
- duration_seconds: how long impersonation lasted

**Given** I am Super Admin
**When** I view Admin > Audit Log
**Then** I can filter by "Impersonation Actions"
**And** I see all impersonation sessions with details

## Implementation

### Database
- `audit_log` table created in migration 20260201000001
- Columns: id, event_type, user_id, target_org_id, target_user_id, metadata, created_at

### Server Actions
- `startViewAsOrg()` and `startViewAsUser()` create audit records
- `exitViewAs()` creates end record with duration
- All impersonation actions include context in audit metadata

### Audit Events
- `view_as_org_start` - Started org impersonation
- `view_as_user_start` - Started user impersonation
- `view_as_end` - Ended impersonation session
- `view_as_readonly_toggle` - Toggled read-only mode
