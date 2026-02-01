# Multi-Tenant Architecture Design

**Date:** 2026-02-01
**Status:** Analysis Complete - Ready for Architecture Update
**Context:** Deep discussion on organization, user, and permission model for full Timber World Platform
**Builds On:** Current MVP (Epics 1-9 complete), Architecture Addendum (2026-01-25)

---

## Executive Summary

This document captures a comprehensive discussion on the multi-tenant, multi-user, multi-organization architecture for the Timber World Platform. The design goes beyond the current MVP implementation to define a scalable foundation for all future platform apps (Client Portal, Supplier Portal, Sales Portal, etc.).

**Key Insight:** Timber World (the IT platform) is NOT an organization - it's the platform operator. All business entities (Principals, Producers, Suppliers, Clients, Traders) are peer organizations with different feature sets enabled.

---

## Platform Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIMBER WORLD PLATFORM                        │
│                      (IT Infrastructure)                        │
│                                                                 │
│   Super Admin: Full control, configures everything              │
│   Delegated Admins (future): Subset of super admin powers       │
│   NOT a business entity - just the technology layer             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Manages all tenants
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     ALL ORGANIZATIONS ARE PEERS                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│      ┌──────────┐          ┌──────────┐          ┌──────────┐   │
│      │ Org A    │          │ Org B    │          │ Org C    │   │
│      │ type:    │◄────────►│ type:    │◄────────►│ type:    │   │
│      │ Principal│          │ Producer │          │ Supplier │   │
│      └──────────┘          └──────────┘          └──────────┘   │
│           ▲                      ▲                    ▲         │
│           │                      │                    │         │
│           ▼                      ▼                    ▼         │
│      ┌──────────┐          ┌──────────┐          ┌──────────┐   │
│      │ Org D    │◄────────►│ Org E    │◄────────►│ Org F    │   │
│      │ type:    │          │ type:    │          │ type:    │   │
│      │ Client   │          │ Trader   │          │ Logistics│   │
│      └──────────┘          └──────────┘          └──────────┘   │
│                                                                 │
│  • Every org is a peer - same level in the system               │
│  • Relationships are edges between nodes (buyer↔seller, etc.)   │
│  • Any org can have relationships with any other org            │
│  • Type is just a tag for defaults and semantics                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Organization Types (Tags, Not Classes)

**Key Decision:** Organization types are TAGS, not different database entities. All organizations use the same table structure. "Type" determines:
- Default feature set (template)
- Semantic categorization (for reporting, filtering)
- UI labeling

An organization can have MULTIPLE types (e.g., a company that is both Client and Supplier).

### Type Definitions (from Principal's Perspective)

| Type | Definition | Typical Features |
|------|------------|------------------|
| **Principal** | Owns materials, orchestrates supply chain, employs sales/procurement | Full access: inventory, production, orders, CRM, analytics |
| **Producer** | Manufactures products FOR Principals | Inventory view, production tracking, efficiency metrics |
| **Supplier** | Provides raw materials TO Principals | Order viewing, delivery confirmation, invoice submission |
| **Client** | Buys finished products FROM Principals | Ordering, tracking, reorder, invoice viewing |
| **Trader** | Intermediary - buys from X, sells to Y | Ordering, supplier management, client management |
| **Logistics** | Transports goods between parties | Shipment tracking, CMR access, packing lists |

### Why "Principal"?

The term "Principal" was chosen because:
- Legal/trading term for the party on whose behalf agents act
- Entity that owns goods and takes business risk
- Distinct from brokers/agents who just facilitate
- Clear distinction from other org types

---

## User Model

### Three Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 1: PLATFORM USERS                                        │
│  (Not part of any organization - they manage the platform)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Super Admin (Nils)                                             │
│  • Full access to everything                                    │
│  • Create/manage organizations                                  │
│  • Configure features per org                                   │
│  • Manage all users                                             │
│  • "View As" any org/user for testing                          │
│                                                                 │
│  Delegated Platform Admins (future)                             │
│  • Subset of super admin powers                                 │
│  • Configurable permissions                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 2: ORGANIZATION ADMINS                                   │
│  (Optional role within an org for self-service user mgmt)       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Org Admin (just a role, not required)                          │
│  • Add/remove users in their org                                │
│  • Assign permissions to users (within org's allowed features)  │
│  • Cannot change org's feature set (only super admin can)       │
│  • Cannot see other organizations                               │
│                                                                 │
│  For small orgs: Super Admin manages users directly             │
│  For larger orgs: Org Admin role assigned to 1-2 people         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 3: ORGANIZATION USERS                                    │
│  (Regular users who work within an organization)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Each user has:                                                 │
│  • One platform identity (one login)                            │
│  • Memberships in one or more organizations                     │
│  • Roles assigned per organization                              │
│  • Optional permission overrides per organization               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Organization Membership

**Key Decision:** A user can belong to MULTIPLE organizations.

```
User: john@email.com
├── Platform identity (one login)
│
├── Membership: "Acme Trading Ltd" (Principal)
│   ├── Roles: [Sales Agent, Inventory Viewer]
│   └── Overrides: [+reports.export, -orders.delete]
│
└── Membership: "Beta Transport" (Logistics)
    ├── Roles: [Logistics Coordinator]
    └── Overrides: []

When John logs in:
• Sees org switcher (Acme / Beta)
• Selects org → sees features based on that membership
```

---

## Permission Model

### Three Layers

```
Layer 1: Organization Features
├── What features/pages the ORG can access
├── Configured by Super Admin
├── Based on org type template + customization
└── Example: "Acme Trading" has [orders, inventory, production, reports]

Layer 2: Role Permissions
├── Global role templates (same definition everywhere)
├── Each role = bundle of feature permissions
├── User can have multiple roles
└── Example: "Sales Agent" role grants [orders.*, clients.view]

Layer 3: User Overrides
├── Add or remove specific permissions for a user
├── Applies within a specific organization
└── Example: Sarah gets +inventory.view, -orders.delete
```

### Permission Calculation

```
User's effective permissions in Org X =

  (Org X's enabled features)
      ∩  (intersection)
  (Sum of all role permissions)
      +  (plus overrides)
      -  (minus overrides)
```

**Example:**

```
Org "Acme Trading" has features enabled:
  orders.*, inventory.*, clients.*, reports.*

User Sarah in "Acme Trading":
  Roles: [Sales Agent]
    → Sales Agent grants: orders.*, clients.*

  Overrides:
    +inventory.view (added)
    -orders.delete (removed)

Sarah's effective permissions:
  orders.view ✓
  orders.create ✓
  orders.edit ✓
  orders.delete ✗ (removed by override)
  clients.* ✓
  inventory.view ✓ (added by override)
  inventory.edit ✗ (not in role, not in override)
  reports.* ✗ (not in role)
```

### Roles Are Global

**Key Decision:** Roles are defined globally (not per-org), but overrides allow customization.

- "Sales Agent" role means the same thing everywhere
- When creating an org, pick a type template → sets initial features
- Super Admin can customize features per org
- Org Admin (or Super Admin) can assign roles to users
- Overrides handle exceptions

---

## Organization Relationships

### Two Concepts to Separate

**Org Type** (what the organization IS):
- Principal, Producer, Supplier, Client, Trader, Logistics
- Tags that describe the organization's business
- Used for defaults, templates, categorization
- An org can have multiple types

**Relationship Role** (what role they play in a specific connection):
- In a transaction/relationship between Org A and Org B:
  - One is the **seller/supplier** (providing something)
  - One is the **buyer/client** (receiving something)

These can overlap or differ:

| Org Type | Can be Seller to | Can be Buyer from |
|----------|------------------|-------------------|
| Supplier | Principal, Trader | (raw material sources) |
| Producer | Principal, Trader | Principal (materials) |
| Principal | Client, Trader | Supplier, Producer |
| Client | (rarely) | Principal, Trader |
| Trader | Anyone | Anyone |

### Relationship Data Model

```sql
organization_relationships (
  id
  party_a_id       -- The seller/supplier in this relationship
  party_b_id       -- The buyer/client in this relationship
  relationship_type -- "trade", "production", "logistics", etc.
  metadata         -- Contract details, etc.
  created_at
)
```

**When Org E (Trader) views their portal:**
- "My Suppliers" = relationships where E is party_b (buyer)
- "My Clients" = relationships where E is party_a (seller)

Same data, different perspective.

---

## Data Visibility

### Default: Isolation

Each organization sees only their own data by default.

### Cross-Org Visibility (Grantable)

For specific use cases, visibility can be granted:

| Use Case | What They See | What They Don't See |
|----------|---------------|---------------------|
| Logistics Company | Shipment data, CMRs, packing lists | Inventory, pricing, financials |
| Salesperson | List of client orgs (for anti-collision) | Detailed sales data of other salespeople's clients |
| Transportation | Product movements | Inventory levels, production data |

Cross-org visibility is:
- Granted by Super Admin
- Specific to data types (not all-or-nothing)
- Auditable

---

## Super Admin "View As" Feature

Super Admin can impersonate any organization or user for testing/support:

```
┌─────────────────────────────────────────────────────────────────┐
│  Super Admin UI                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Platform Admin   │  │ View as: [Select organization ▼]   │  │
│  │ (normal mode)    │  │                                     │  │
│  └──────────────────┘  │  • Acme Trading (Principal)         │  │
│                        │  • Beta Factory (Producer)          │  │
│                        │  • Gamma Supplies (Supplier)        │  │
│                        │  └─ + Select user to impersonate    │  │
│                        └─────────────────────────────────────┘  │
│                                                                 │
│  When "View as" is active:                                      │
│  • See exactly what that org/user sees                          │
│  • Same features, same data, same UI                            │
│  • Banner at top: "Viewing as: Acme Trading / John"             │
│  • Actions are logged (audit trail)                             │
│  • Option: read-only mode or full impersonation                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Use cases:**
- Testing new features before rollout
- Debugging user-reported issues
- Training/demos
- Support (seeing what the user sees)

---

## Data Model (Proposed)

### Organizations

```sql
organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,  -- 3-letter code (TWP, INE, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Types are tags (many-to-many)
organization_types (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,           -- "principal", "producer", etc.
  description TEXT,
  icon TEXT,
  default_features TEXT[]       -- Template: what features to enable by default
)

organization_type_assignments (
  organization_id UUID REFERENCES organizations(id),
  type_id UUID REFERENCES organization_types(id),
  PRIMARY KEY (organization_id, type_id)
)

-- Features enabled for an org
organization_features (
  organization_id UUID REFERENCES organizations(id),
  feature TEXT NOT NULL,        -- e.g., "orders", "inventory.edit"
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (organization_id, feature)
)

-- Relationships between orgs
organization_relationships (
  id UUID PRIMARY KEY,
  party_a_id UUID REFERENCES organizations(id),  -- seller/supplier role
  party_b_id UUID REFERENCES organizations(id),  -- buyer/client role
  relationship_type TEXT,       -- "supplier_client", "producer_principal", etc.
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

### Users

```sql
-- Platform-level users (super admins)
platform_admins (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  permissions TEXT[],           -- What they can do at platform level
  created_at TIMESTAMPTZ
)

-- All users (single identity)
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  auth_provider TEXT,           -- Supabase auth reference
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- User membership in organizations
organization_memberships (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  UNIQUE (user_id, organization_id)
)
```

### Roles & Permissions

```sql
-- Roles (global templates)
roles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,           -- "Sales Agent", "Org Admin", etc.
  description TEXT,
  permissions TEXT[],           -- Array of permission codes
  is_system BOOLEAN DEFAULT false,  -- Built-in vs custom
  created_at TIMESTAMPTZ
)

-- User's roles within an org
user_roles (
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, organization_id, role_id)
)

-- User's permission overrides within an org
user_permission_overrides (
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  permission TEXT NOT NULL,     -- e.g., "orders.delete"
  granted BOOLEAN NOT NULL,     -- true = add, false = remove
  PRIMARY KEY (user_id, organization_id, permission)
)

-- Features (all available in the system)
features (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,    -- "orders.view", "inventory.edit", etc.
  name TEXT NOT NULL,
  description TEXT,
  category TEXT                 -- For grouping in UI
)

-- Feature templates by org type
organization_type_features (
  type_id UUID REFERENCES organization_types(id),
  feature TEXT NOT NULL,
  PRIMARY KEY (type_id, feature)
)
```

---

## Comparison: Current MVP vs. Target Architecture

| Aspect | Current MVP | Target Architecture |
|--------|-------------|---------------------|
| Org types | Implicit (admin/producer) | Explicit tags: Principal, Producer, Supplier, Client, Trader, Logistics |
| User membership | User → 1 org | User → multiple orgs |
| Roles | Simple admin/producer | Global role templates + per-user overrides |
| Features | Hardcoded by role | Configurable per org + per user |
| Relationships | Via shipments only | Explicit relationship table |
| Cross-org visibility | Only through shipments | Grantable per data type |
| View As | Org selector dropdown | Full impersonation with audit |
| Platform admins | Single super admin | Super Admin + delegated admins |

---

## Migration Path

### Phase 1: Document (Complete)
- ✅ Capture target architecture (this document)

### Phase 2: Architecture Update
- Update `architecture.md` with formal addendum
- Define migration strategy for existing data
- Plan backward compatibility

### Phase 3: Database Migration
- Add new tables (organization_types, roles, etc.)
- Migrate existing data
- Add multi-org membership support

### Phase 4: Feature Implementation
- Implement org type configuration
- Implement multi-org user membership
- Implement role/permission system
- Implement View As feature

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform vs Organization | Platform is NOT an org | Separates IT infrastructure from business entities |
| Org hierarchy | All orgs are peers | No IT hierarchy, Principal is just another org with more features |
| Org types | Tags, not classes | Flexibility, multi-type support, no code duplication |
| User membership | Multi-org | Real-world scenario: consultants, agents working for multiple companies |
| Roles | Global with overrides | Simplicity of global templates + flexibility of per-user customization |
| Features | Configurable per org | Each org gets exactly what they need, nothing more |
| Org Admin | Optional role | Small orgs: Super Admin manages; Large orgs: delegate to Org Admin |
| Data isolation | Default isolated, grantable cross-org | Security by default, flexibility when needed |
| Super Admin org membership | NOT a member | Super Admin is above orgs, uses "View As" when needed |

---

## Next Steps

1. **Review this document** with stakeholders
2. **Update architecture.md** with formal addendum
3. **Create implementation epics** for platform architecture v2
4. **Prioritize** which features to implement first based on business needs

---

## Session Notes

This document was created from a detailed discussion on 2026-02-01 between Nils and Claude, exploring the multi-tenant architecture from first principles. The discussion covered:

1. Organization structure and hierarchy
2. User model and multi-org membership
3. Permission system design
4. Cross-org data visibility
5. Super Admin capabilities
6. Relationship between orgs

The resulting design provides a scalable foundation for the full Timber World Platform while building on the existing MVP implementation.
