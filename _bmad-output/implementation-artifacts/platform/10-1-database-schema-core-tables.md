# Story 10.1: Database Schema - Core Tables

> **Extends Story 6.1** - Adds new tables alongside existing schema (organization_types, memberships, features, roles, permissions). Does not modify existing tables except adding `is_platform_admin` to portal_users.

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** developer,
**I want** all new multi-tenant tables created in the database,
**So that** the foundation exists for the new architecture.

## Acceptance Criteria

**Given** the existing database schema
**When** migrations are applied
**Then** the following tables exist:

1. `organization_types` with columns:
   - id (UUID, PK)
   - name (TEXT, unique) - "principal", "producer", etc.
   - description (TEXT)
   - icon (TEXT, nullable)
   - default_features (TEXT[])
   - sort_order (INTEGER)
   - created_at (TIMESTAMPTZ)

2. `organization_type_assignments` with columns:
   - organization_id (UUID, FK to organisations)
   - type_id (UUID, FK to organization_types)
   - PRIMARY KEY (organization_id, type_id)

3. `organization_relationships` with columns:
   - id (UUID, PK)
   - party_a_id (UUID, FK) - seller/supplier role
   - party_b_id (UUID, FK) - buyer/client role
   - relationship_type (TEXT)
   - metadata (JSONB, nullable)
   - is_active (BOOLEAN, default true)
   - created_at (TIMESTAMPTZ)
   - CHECK constraint: party_a_id != party_b_id

4. `organization_memberships` with columns:
   - id (UUID, PK)
   - user_id (UUID, FK to portal_users)
   - organization_id (UUID, FK to organisations)
   - is_active (BOOLEAN, default true)
   - is_primary (BOOLEAN, default false)
   - invited_at (TIMESTAMPTZ, nullable)
   - invited_by (UUID, FK, nullable)
   - created_at (TIMESTAMPTZ)
   - UNIQUE (user_id, organization_id)

5. `features` with columns:
   - id (UUID, PK)
   - code (TEXT, unique) - "orders.view", "inventory.edit"
   - name (TEXT)
   - description (TEXT, nullable)
   - category (TEXT, nullable)
   - sort_order (INTEGER)
   - created_at (TIMESTAMPTZ)

6. `organization_features` with columns:
   - organization_id (UUID, FK)
   - feature_code (TEXT)
   - enabled (BOOLEAN, default true)
   - PRIMARY KEY (organization_id, feature_code)

7. `roles` with columns:
   - id (UUID, PK)
   - name (TEXT, unique)
   - description (TEXT, nullable)
   - permissions (TEXT[])
   - is_system (BOOLEAN, default false)
   - created_at (TIMESTAMPTZ)

8. `user_roles` with columns:
   - user_id (UUID, FK)
   - organization_id (UUID, FK)
   - role_id (UUID, FK)
   - PRIMARY KEY (user_id, organization_id, role_id)

9. `user_permission_overrides` with columns:
   - user_id (UUID, FK)
   - organization_id (UUID, FK)
   - feature_code (TEXT)
   - granted (BOOLEAN) - true = add, false = remove
   - PRIMARY KEY (user_id, organization_id, feature_code)

**And** `portal_users` table has new column:
   - is_platform_admin (BOOLEAN, default false)

**And** appropriate indexes are created for foreign keys and common queries

## Implementation

### Files Created
- `supabase/migrations/20260201000001_epic10_core_tables.sql`

### Database Changes
- Created 9 new tables as specified
- Added `is_platform_admin` column to `portal_users`
- Added `audit_log` table for impersonation tracking
- Created appropriate indexes and foreign key constraints
