# Story 10.3: Seed Features Registry

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** developer,
**I want** all system features registered in the database,
**So that** they can be enabled/disabled per organization.

## Acceptance Criteria

**Given** the features table exists
**When** seed migration runs
**Then** features are registered by category:

**Dashboard:**
- dashboard.view - View dashboard metrics

**Inventory:**
- inventory.view - View inventory packages
- inventory.create - Create inventory entries
- inventory.edit - Edit inventory packages
- inventory.delete - Delete inventory packages

**Production:**
- production.view - View production entries
- production.create - Create production entries
- production.edit - Edit draft production
- production.validate - Validate production entries
- production.delete - Delete production entries
- production.corrections - Create correction entries

**Shipments:**
- shipments.view - View shipments
- shipments.create - Create shipments
- shipments.edit - Edit draft shipments
- shipments.delete - Delete shipments
- shipments.submit - Submit for acceptance
- shipments.accept - Accept incoming shipments
- shipments.reject - Reject incoming shipments

**Reference Data:**
- reference.view - View reference data
- reference.manage - Manage reference data options

**Organizations:**
- organizations.view - View organizations
- organizations.create - Create organizations
- organizations.edit - Edit organizations
- organizations.delete - Delete organizations

**Users:**
- users.view - View users in organization
- users.invite - Invite new users
- users.edit - Edit user details
- users.remove - Remove users
- users.credentials - Send/reset credentials

**Analytics:**
- analytics.view - View efficiency reports
- analytics.export - Export data

**And** features are ordered logically within each category

## Implementation

### Files Created
- `supabase/migrations/20260201000003_epic10_seed_features.sql`

### Seeded Data
- 40+ platform features organized by category
- Each feature has code, name, description, category, and sort_order
