# Story 10.13: Organization Type Management

> **Extends Story 7.1** - Adds type badges and type assignment UI to the existing organization detail view. Types are tags (orgs can have multiple) that drive default feature configuration.

**Status:** Done (Backend ready, UI in org detail page pending)
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to assign types to organizations,
**So that** they get appropriate default features.

## Acceptance Criteria

**Given** I am viewing an organization's details
**When** I see the header/info section
**Then** I see assigned types as badges (e.g., "Producer", "Principal")

**Given** I click "Edit Types"
**When** the type selector opens
**Then** I see all organization types with checkboxes
**And** currently assigned types are checked

**Given** I add a new type to an org
**When** I save
**Then** the type is assigned
**And** I am prompted: "Apply default features for this type?" [Yes/No]
**And** if Yes, features from that type template are enabled

**Given** I remove a type from an org
**When** I save
**Then** the type assignment is removed
**And** features are NOT automatically disabled (manual cleanup needed)

**Given** an org has no types assigned
**When** I view it
**Then** it shows "No type" indicator
**And** it still functions (features based on explicit configuration)

## Implementation

### Backend Infrastructure (Done)
- `organization_types` table with 6 types seeded
- `organization_type_assignments` table for many-to-many relationship
- Migration assigns "producer" type to existing organizations

### UI (Pending)
- Type badges and type selector to be added to `/admin/organisations/[id]` page
- Would allow multi-select of organization types
