# Story 10.5: Migrate Users to Memberships

> **Supersedes Story 6.1 user model** - Evolves from single `organisation_id` on users to multi-org memberships. Existing org_id is preserved for backward compatibility; memberships table becomes the source of truth.

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** developer,
**I want** existing users migrated to the membership model,
**So that** multi-org support works with existing data.

## Acceptance Criteria

**Given** users exist with organisation_id set
**When** migration runs
**Then** for each user with organisation_id:
- A record is created in organization_memberships
- is_primary = true (their only org becomes primary)
- is_active = true

**And** the current Super Admin (admin role, org_id = null):
- Gets is_platform_admin = true
- No membership record (platform-level user)

**And** existing user sessions continue to work
**And** the organisation_id column on portal_users is kept for backward compatibility during transition

## Implementation

### Files Created
- `supabase/migrations/20260201000005_epic10_migrate_users.sql`

### Migration Logic
1. Set `is_platform_admin = true` for users with `role = 'admin'` and `organisation_id IS NULL`
2. Create membership records for all users with `organisation_id` set
3. Assign default roles based on existing role column:
   - 'admin' role → Full Access
   - 'producer' role → Production Manager
4. Initialize organization features from type defaults
