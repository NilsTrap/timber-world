# Timber World Platform Vision Capture

**Date:** 2026-01-20
**Status:** DRAFT - Captured from Party Mode discussion, pending deep analysis
**Next Step:** Deep analysis with Mary (Analyst) → Platform Product Brief workflow

---

## Executive Summary

Timber World is evolving from a single marketing website into a **B2B Supply Chain Platform** that orchestrates timber production, trading, and sales across multiple user types. The platform will use a single Supabase database serving multiple frontend applications.

---

## Business Model

**Primary Model:** Platform/Marketplace + Production Orchestrator

- Timber World often **owns the raw materials**
- **Producers/factories** (both owned and partner) manufacture products using Timber World's raw materials
- **Suppliers** provide timber to Timber World
- **Clients** (B2B) purchase finished products
- Sometimes pure trading: buy from external producers, sell to clients

**Key Differentiator:** "Production Orchestrator" - Timber World controls quality and accountability throughout the supply chain without necessarily owning all production facilities.

---

## Platform Architecture

### Technical Foundation (Already Implemented 2026-01-20)

```
timber-world/                    # Turborepo monorepo
├── apps/
│   └── marketing/               # ✅ Exists - Public marketing site
│   # Planned:
│   # └── client-portal/         # B2B customer portal
│   # └── producer-portal/       # Factory/producer portal
│   # └── admin/                 # Internal administration
│   # └── supplier-portal/       # Supplier portal
│
├── packages/                    # ✅ Shared code (implemented)
│   ├── @timber/ui/              # Components + hooks
│   ├── @timber/auth/            # Authentication
│   ├── @timber/database/        # Supabase clients + types
│   ├── @timber/config/          # Configuration + i18n
│   └── @timber/utils/           # Utilities
│
└── supabase/                    # ONE database for ALL apps
```

---

## User Types & Portals

### 1. Marketing App (Public)
- **Users:** Anonymous visitors, prospects
- **Purpose:** Brand showcase, product catalog, lead generation, quote requests
- **Status:** ✅ Foundation complete (Epic 1-2 done)

### 2. Client Portal (B2B Customers)
- **Users:** Erik (furniture producer), Anna (installer), existing customers
- **Key Functions:**
  - User authentication (login/registration)
  - View orders and order history
  - Submit new orders
  - Reorder previous orders
  - Track shipments
  - View invoices
  - Communication with Timber World

### 3. Producer Portal (Factories)
- **Users:** Owned factories + partner production facilities
- **Key Functions:**
  - View orders assigned by Timber World
  - Report production progress
  - Track efficiency metrics
  - Log raw material usage (Timber World supplies materials)
  - Report quality metrics
  - Manage inventory levels
  - Submit completed production
- **Note:** Each factory may need their own branded/isolated view

### 4. Admin Portal(s) (Internal Staff)
- **Users:** Sales team, operations, management, executives
- **Key Functions:**
  - Quote management
  - Order management
  - Supplier oversight
  - Producer oversight
  - Analytics and reporting
- **Variants Needed:**
  - Manager Portal - day-to-day operations
  - Analytics Portal - data analysis and insights
  - Head Office Portal - executive overview, totals, KPIs

### 5. Supplier Portal
- **Users:** Timber suppliers (raw material providers)
- **Key Functions:**
  - View orders to fulfill
  - Submit delivery notifications
  - Upload/manage invoices
  - Real-time sync with central database
  - Communication with Timber World

### 6. Future Portals (Potential)
- Marketing agency access
- Logistics partner portal
- Third-party integrations

---

## Data Flow Diagram

```
┌─────────────┐                                    ┌─────────────┐
│  SUPPLIERS  │                                    │   CLIENTS   │
│ (raw timber)│                                    │ (B2B buyers)│
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ Supplier Portal                    Client Portal │
       │ • Orders to fulfill                • Browse/order │
       │ • Deliveries                       • Track orders │
       │ • Invoices                         • Reorder      │
       ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    TIMBER WORLD PLATFORM                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CENTRAL SUPABASE DATABASE                   │   │
│  │  • Products  • Orders  • Users  • Inventory  • Quotes   │   │
│  │  • Production tracking  • Invoices  • Analytics         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              ┌───────────────┼───────────────┐                 │
│              ▼               ▼               ▼                 │
│      ┌───────────┐   ┌───────────┐   ┌───────────┐            │
│      │  ADMIN    │   │ MARKETING │   │ ANALYTICS │            │
│      │  PORTAL   │   │   SITE    │   │  PORTAL   │            │
│      └───────────┘   └───────────┘   └───────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Producer Portal
                               │ • Orders from TW
                               │ • Production tracking
                               │ • Efficiency/quality
                               │ • Inventory
                               │ • Raw material usage
                               ▼
                    ┌─────────────────┐
                    │    PRODUCERS    │
                    │   (factories)   │
                    │  owned + partner│
                    └─────────────────┘
```

---

## Relationship to Existing Documentation

| Document | Current Scope | Needed Update |
|----------|---------------|---------------|
| `product-brief-Timber-International-2026-01-04.md` | Marketing website only | Keep as "Marketing App Brief", create Platform Brief |
| `prd.md` | Marketing website (56 FRs) | Keep as "Marketing App PRD", create Platform PRD |
| `architecture.md` | Single Next.js app | **Outdated** - code is now monorepo. Needs platform architecture doc |
| `epic-*.yaml` | Marketing website features | Keep as marketing app stories, create stories for other apps |
| `sprint-status.yaml` | Marketing app progress | Restructure for multi-app tracking |

---

## Recommended Documentation Structure (Hierarchical)

```
_bmad-output/
├── planning-artifacts/
│   ├── PLATFORM-product-brief.md          # NEW: Overall Timber World vision
│   ├── PLATFORM-prd.md                    # NEW: Platform-level requirements
│   ├── PLATFORM-architecture.md           # NEW: Multi-app architecture
│   │
│   ├── product-brief-*.md                 # KEEP: Marketing app brief
│   ├── prd.md                             # KEEP: Marketing app PRD
│   └── architecture.md                    # UPDATE: Note it's marketing-specific
│
└── implementation-artifacts/
    ├── marketing/                         # KEEP: Existing epics/stories
    │   ├── epic-1.yaml ... epic-8.yaml
    │   └── sprint-status.yaml
    ├── client-portal/                     # NEW (future)
    ├── producer-portal/                   # NEW (future)
    ├── admin/                             # NEW (future)
    └── supplier-portal/                   # NEW (future)
```

---

## Next Steps (When Nils Has Time)

1. **Deep Analysis Session with Mary (Analyst)**
   - Explore each portal in detail
   - Define user personas for each portal
   - Map data flows and relationships
   - Identify MVP scope for platform

2. **Create Platform Product Brief**
   - Use `/bmad:bmm:workflows:create-product-brief`
   - Capture the full platform vision formally

3. **Create Platform PRD**
   - Define requirements for all portals
   - Prioritize which apps to build first

4. **Update Platform Architecture**
   - Document the Turborepo structure
   - Define shared vs app-specific concerns
   - Plan database schema expansion

5. **Decide Implementation Order**
   - Option A: Supabase schema first (expand for all apps)
   - Option B: Client Portal next (customer-facing value)
   - Option C: Admin Portal next (internal operations)

---

## How to Resume This Work

**To continue the platform planning:**

1. Start a new Claude Code session in this directory
2. Say: "Let's continue with the Timber World platform planning. Read the platform vision capture document and let's do deep analysis with Mary."
3. Or run: `/bmad:bmm:workflows:create-product-brief` and reference this document

**Key file to reference:** `_bmad-output/analysis/platform-vision-capture-2026-01-20.md`

---

## Session Notes

- This document was created during a Party Mode session on 2026-01-20
- The Turborepo monorepo structure was implemented earlier the same day
- Marketing app Epics 1-2 are complete, Epic 3+ are in backlog
- Epics 6-7-8 were moved back to backlog (admin features deprioritized until platform vision is clear)
