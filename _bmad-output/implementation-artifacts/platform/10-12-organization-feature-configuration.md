# Story 10.12: Organization Feature Configuration

> **Extends Story 7.1** - Adds a "Features" tab to the existing organization detail view. This is the first layer of the permission model (what the org can access).

**Status:** Done (Backend ready, UI in org detail page pending)
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to configure which features each organization can access,
**So that** different org types have appropriate capabilities.

## Acceptance Criteria

**Given** I am viewing an organization's details
**When** I click "Features" tab
**Then** I see all features grouped by category
**And** each feature has an enable/disable toggle
**And** features enabled by the org's type template are shown as defaults

**Given** I toggle a feature off
**When** I save
**Then** no user in that org can access that feature
**And** users see appropriate UI (hidden menu items, disabled buttons)

**Given** I toggle a feature on
**When** I save
**Then** users with appropriate roles can access the feature

**Given** I want to reset to defaults
**When** I click "Reset to Type Defaults"
**Then** features are reset based on org's assigned type(s)
**And** I see confirmation before reset

**Given** an org has multiple types assigned
**When** I view features
**Then** default features are union of all type defaults

## Implementation

### Backend Infrastructure (Done)
- `organization_features` table created
- Migration initializes features from org type defaults
- Permission checking respects org feature enablement

### UI (Pending)
- Features tab to be added to `/admin/organisations/[id]` page
- Would show categorized feature toggles with enable/disable
