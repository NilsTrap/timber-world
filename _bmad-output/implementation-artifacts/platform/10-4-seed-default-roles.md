# Story 10.4: Seed Default Roles

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** default roles available in the system,
**So that** I can assign them to users.

## Acceptance Criteria

**Given** the roles table exists
**When** seed migration runs
**Then** the following system roles exist:

| Role | Description | Permissions |
|------|-------------|-------------|
| Full Access | All features (for org owner) | * |
| Org Admin | Manages users within organization | users.* |
| Production Manager | Full production access | production.*, inventory.view, shipments.view, dashboard.view |
| Inventory Manager | Manages inventory | inventory.*, shipments.*, dashboard.view |
| Viewer | Read-only access | dashboard.view, inventory.view, production.view, shipments.view |

**And** all seeded roles have is_system = true
**And** system roles cannot be deleted (only deactivated)

## Implementation

### Files Created
- `supabase/migrations/20260201000004_epic10_seed_roles.sql`

### Seeded Data
- 5 default system roles with appropriate permission sets
- All seeded roles marked as `is_system = true`
