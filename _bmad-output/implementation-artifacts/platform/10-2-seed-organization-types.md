# Story 10.2: Seed Organization Types

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** organization types pre-populated in the system,
**So that** I can assign types to organizations.

## Acceptance Criteria

**Given** the organization_types table exists
**When** seed migration runs
**Then** the following types exist:

| Name | Description | Default Features |
|------|-------------|------------------|
| principal | Owns materials, orchestrates supply chain | inventory.*, production.*, shipments.*, orders.*, analytics.*, users.* |
| producer | Manufactures products | inventory.view, production.*, shipments.*, dashboard.view |
| supplier | Provides raw materials | orders.view, deliveries.*, invoices.* |
| client | Buys finished products | orders.*, tracking.view, invoices.view, reorder.* |
| trader | Intermediary buyer/seller | orders.*, suppliers.*, clients.*, inventory.view |
| logistics | Transports goods | shipments.view, tracking.*, documents.view |

**And** existing organizations are assigned types:
- TWP (Timber World Platform) → principal
- All other organizations → producer (default based on current usage)

**And** the type assignments can be viewed in Admin > Organisations

## Implementation

### Files Created
- `supabase/migrations/20260201000002_epic10_seed_org_types.sql`

### Seeded Data
- 6 organization types with default features
- Existing organizations assigned appropriate types based on usage patterns
