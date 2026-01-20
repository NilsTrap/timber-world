# Timber World Platform - Deep Analysis Document

**Date:** 2026-01-20
**Status:** IN PROGRESS
**Analyst:** Mary (Business Analyst)
**Stakeholder:** Nils (Owner)
**Purpose:** Comprehensive discovery session to inform Platform Product Brief

---

## Table of Contents

1. [Analysis Progress](#analysis-progress)
2. [Area 1: Business Model](#area-1-business-model)
3. [Area 2: User Personas & Portals](#area-2-user-personas--portals)
4. [Area 3: Data Model](#area-3-data-model) - PENDING
5. [Area 4: Integration Points](#area-4-integration-points) - PENDING
6. [Area 5: MVP Prioritization](#area-5-mvp-prioritization) - PENDING
7. [Design Principles Discovered](#design-principles-discovered)
8. [Open Questions](#open-questions)

---

## Analysis Progress

| Area | Status | Completion |
|------|--------|------------|
| 1. Business Model | ✅ Complete | 100% |
| 2. User Personas & Portals | ✅ Complete | 100% |
| 3. Data Model | ⏳ Pending | 0% |
| 4. Integration Points | ⏳ Pending | 0% |
| 5. MVP Prioritization | ⏳ Pending | 0% |

**Last Updated:** 2026-01-20 (after Question 2.9 - Architecture Decision)

---

## Area 1: Business Model

### 1.1 Revenue Streams

| Stream | Description | Share |
|--------|-------------|-------|
| **Production Margin** | Buy logs → Process through factories → Sell finished goods | ~50% |
| **Trading Margin** | Buy finished goods from external sources → Resell to clients | ~50% |
| **Platform Fees** | None - platform is FREE for partners | 0% |

**Key Insight:** All transactions are buy/sell. Timber World takes ownership of goods at each stage. No commission model.

### 1.2 Supply Chain Model

**Timber World is a "Production Orchestrator"** - controls quality and accountability throughout the supply chain without necessarily owning all production facilities.

#### What Timber World OWNS:
- Raw materials (logs, timber at every stage)
- Customer relationships
- Brand and reputation
- Quality standards

#### What Timber World CONTROLS:
- Production schedules
- Quality inspection
- Pricing
- Which factory does what

#### What Timber World PAYS FOR:
- Raw materials from suppliers
- Processing services from factories

#### What Timber World DOESN'T OWN:
- All factories - mix of owned, partner, and outsourced

### 1.3 Production Flow

**Entry and exit can happen at ANY stage:**

```
ENTRY POINTS (Suppliers can enter at ANY stage):
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  LOGS ──► SAWMILL ──► KILNS ──► PANELS ──► MACHINING ──► FINISHING     │
│    │         │          │          │           │             │          │
│    └─────────┴──────────┴──────────┴───────────┴─────────────┘          │
│              │                                                          │
│              ▼                                                          │
│    EXIT POINTS (Can sell at ANY stage)                                  │
│                                                                         │
│    Factories: Can do MULTIPLE stages                                    │
│    Ownership: Doesn't matter (owned/partner/outsourced = same portal)   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Production Stages:**
1. **LOGS** - Bought from logging companies
2. **SAWMILL** - Logs cut into lumber/boards
3. **KILNS** - Drying the wood
4. **PANELS** - Gluing boards into panels (FJ or FS), or beams
5. **MACHINING** - CNC, cutting to shapes/dimensions, other machining
6. **FINISHING** - Varnishing, lacquering, oiling

**Important Notes:**
- Stages can be mixed or excluded
- Not all products go through all stages
- Single factory can do multiple stages
- Can enter supply chain at any stage (buy logs, boards, kiln-dried, panels, etc.)
- Can exit at any stage (sell boards, panels, finished products)

### 1.4 Current Scale

| Factory Type | Count | Status |
|--------------|-------|--------|
| Sawmills | ~2 | Outsourced |
| Kilns/Drying | ~2 | Outsourced |
| Panel Manufacturing | ~2 | Outsourced |
| CNC/Machining | (included above) | Outsourced |
| Finishing | (included above) | Outsourced |

**Future:** Some may become partners, but portal functionality remains the same regardless of ownership status.

### 1.5 Trading Rationale

| Reason | Explanation |
|--------|-------------|
| **Capacity** | Trade volume + production volume = larger total business |
| **Risk mitigation** | Not 100% dependent on own production |
| **Specialty items** | Products Timber World doesn't make or are expensive to make |
| **NOT geography** | Everything goes through warehouse for quality check anyway |

### 1.6 The Scaling Bottleneck (Current Problem)

```
CURRENT STATE:
┌─────────────┐     Email/WhatsApp/Phone      ┌─────────────┐
│  Suppliers  │ ◄──────────────────────────► │ Timber World │
│  (5-10)     │    Manual, time-consuming    │  (3 people)  │
└─────────────┘                               └─────────────┘
                                                    │
                                              Email/WhatsApp/Phone
                                                    │
                                                    ▼
                                              ┌─────────────┐
                                              │   Clients   │
                                              │   (few)     │
                                              └─────────────┘

FUTURE STATE (with platform):
┌─────────────┐      Supplier Portal         ┌─────────────┐
│  Suppliers  │ ◄──────────────────────────► │   TIMBER    │
│ (hundreds)  │    Automated, self-service   │   WORLD     │
└─────────────┘                               │  PLATFORM   │
                                              │             │
┌─────────────┐      Producer Portal         │  (scalable  │
│  Producers  │ ◄──────────────────────────► │   team)     │
│ (hundreds)  │    Automated, self-service   │             │
└─────────────┘                               └─────────────┘
                                                    │
                                               Client Portal
                                              Automated, self-service
                                                    │
                                                    ▼
                                              ┌─────────────┐
                                              │   Clients   │
                                              │ (hundreds)  │
                                              └─────────────┘
```

---

## Area 2: User Personas & Portals

### 2.1 Client Types

| Client Type | Description | Order Pattern | Priority |
|-------------|-------------|---------------|----------|
| **Furniture Producers** | Workshops making furniture | Regular monthly, plan ahead | ⭐ PRIMARY |
| **Installation Professionals** | Stair/kitchen/furniture installers | Mix stock + custom | ⭐ PRIMARY |
| **Bespoke Carpentry** | Small custom project workshops | Project-based | Secondary |
| **DIY Retailers** | Buy wholesale, sell retail | Regular stock replenishment | Secondary |
| **Trading Companies** | Keep local stock for their market | Regular wholesale | Secondary |

**Client Characteristics:**
- Buy regularly (monthly preferred)
- Pricing: Negotiated → Fixed for 6-12 months
- Acquisition: Currently sales agents → Future: website, SEO, referrals
- Small clients viable IF system is automated

### 2.2 Supplier Types

| Supplier Type | Current Scale | Future Scale |
|---------------|---------------|--------------|
| Logging companies | 5-10 | Hundreds |
| Sawmills (selling boards) | 5-10 | Hundreds |
| Kiln operators | 5-10 | Hundreds |
| Panel producers | 5-10 | Hundreds |
| Finishing/Other | 5-10 | Hundreds |

**Supplier Characteristics:**
- Some supply one thing, some multiple stages
- Long-term contracts (years, not transactions)
- **CURRENT PAIN POINT:** Communication via email/WhatsApp/phone = bottleneck

### 2.3 Internal Team

**Current State (Minimal):**

| Person | Roles |
|--------|-------|
| Nils (Owner) | Everything - oversight, decisions, quality |
| Sales Person | Sales + operations + logistics + quality support |
| Finance Person | Finance/accounting |
| External | Outsourced services |

**Future State (Scalable):**
- Role-based access control (not fixed positions)
- Each person can have ONE or MULTIPLE roles assigned
- Roles can be switched ON/OFF per person
- Roles include: Sales, Operations, Quality Control, Logistics, Finance, Management, Admin/Owner

### 2.4 Client Portal Requirements

**Two Client Journeys:**

#### Journey A: New Client
```
New Furniture Producer arrives
       │
       ▼
┌─────────────────────────────────────┐
│  AI QUOTATION SYSTEM                │
│  • Asks questions (voice or text)   │
│  • Understands their needs          │
│  • Generates quote automatically    │
│  • FAST response                    │
└─────────────────────────────────────┘
       │
       ▼
Receives quote → Approves → First order
       │
       ▼
Becomes regular client
```

#### Journey B: Regular Client
```
Regular Furniture Producer logs in
       │
       ▼
┌─────────────────────────────────────┐
│  SMART REORDER                      │
│  • Shows previous orders            │
│  • "Reorder this" one-click         │
│  • Modify quantities/sizes          │
│  • System knows their preferences   │
│  • Instant pricing (negotiated)     │
└─────────────────────────────────────┘
       │
       ▼
Order placed → Confirmation → Track delivery
```

**Client Portal Features (toggleable per client):**

| Feature | Category |
|---------|----------|
| See catalog | Basic (always on) |
| See their negotiated prices | Basic (always on) |
| See current stock availability | Basic (always on) |
| Place new orders | Basic (always on) |
| See order history | Basic (always on) |
| Track order status | Basic (always on) |
| Reorder previous orders easily | Basic (always on) |
| View/download invoices | Basic (always on) |
| View/download packing lists | Basic (always on) |
| Request custom quotes | Advanced (toggle) |
| File/photo upload for custom designs | Advanced (toggle) |
| CAD file integration | Advanced (toggle) |
| Special input forms | Advanced (toggle) |
| Communicate with Timber World | Basic (always on) |
| See delivery schedule | Basic (always on) |
| Report quality issues/complaints | Basic (always on) |

**The Client's Dream:**
- **Transparency** - Prices, quality grades, delivery times all visible
- **Speed** - Fast quotes, fast ordering, fast confirmation
- **Minimal effort** - System predicts needs based on history and profile
- **Smart for new clients** - AI quotation system (voice or text) → fast response
- **Easy for regular clients** - One-click reorder, modify quantities, done
- **Rich information** - As much detail as possible

### 2.5 Supplier Portal Requirements

**Supplier Portal Features:**

| Feature | Priority |
|---------|----------|
| See orders/requests from Timber World | Must Have |
| Confirm they can fulfill an order | Must Have |
| Report delivery schedule | Must Have |
| Submit delivery notification | Must Have |
| Upload packing lists | Must Have |
| Upload invoices | Must Have |
| See payment status | Must Have |
| See order history | Must Have |
| Update their product catalog/availability | Nice to Have |
| Report quality certificates (FSC, etc.) | Nice to Have |
| Communicate with Timber World | Must Have |

**Additional Supplier Requirements:**
- See truck numbers arriving, driver phone numbers
- Full transparency on order status
- Quality specifications with photos (both directions)
- Multi-level access within organization (owner vs production manager)
- Production manager gets limited view (order details, quality specs, NO financial info)

### 2.6 Producer Portal Requirements

**Producer Portal Features:**

| Feature | Priority |
|---------|----------|
| See production orders from Timber World | Must Have |
| Accept/confirm orders | Must Have |
| Report production start | Must Have |
| Report production progress (% complete) | Must Have |
| Report raw material received | Must Have |
| Report raw material usage/waste | Must Have |
| Report quality metrics | Must Have |
| Report finished goods ready | Must Have |
| See efficiency reports | Must Have |
| Report problems/delays | Must Have |
| Upload photos of production/quality | Must Have |
| See inventory at their facility | Must Have |
| Request more raw materials | Must Have |
| View their invoices to Timber World | Must Have |
| See payment status | Must Have |

**Additional Producer Requirements:**
- Feature toggles per producer type (adjustable, prioritized)
- Multi-level access (boss vs production manager)
- Mobile-friendly for production floor
- Quality photos flow both directions
- Should be good enough to replace their internal systems

### 2.7 Admin Portal Requirements

**All admin functions available, toggled per user (not separate portals).**

**Manager Functions (Day-to-Day Operations):**

| Function | Description |
|----------|-------------|
| Quote Management | Create, send, track quotes |
| Order Management | Create, track, modify client orders |
| Supplier Orders | Place and track orders with suppliers |
| Production Orders | Assign work to producers, track progress |
| Inventory View | What's in stock, where, quantities |
| Client Management | Profiles, pricing, history, contacts |
| Supplier Management | Profiles, contracts, performance |
| Producer Management | Factory profiles, capacity, performance |
| Communication Hub | Messages from/to all parties |
| Quality Issues | Track and resolve complaints/problems |
| Logistics | Shipments, tracking, delivery scheduling |
| Warehouse Management | Receiving, shipping, stock movements |

**Analytics Functions:**

| Function | Description |
|----------|-------------|
| Sales Analytics | Revenue, margins, trends by period |
| Client Analytics | Who buys what, frequency, value |
| Supplier Performance | Delivery times, quality, pricing |
| Producer Efficiency | Output rates, waste, quality scores |
| Inventory Analytics | Stock levels, turnover, dead stock |
| Financial Reports | P&L, cash flow, accounts receivable |
| Custom Reports | Build your own queries/reports |

**Executive Functions:**

| Function | Description |
|----------|-------------|
| KPI Dashboard | Key metrics at a glance |
| Total Overview | All business in one view (summary) |
| Alerts/Notifications | Problems needing attention |
| Approvals Queue | Decisions waiting for approval |
| Strategic Reports | Long-term trends, forecasting |

### 2.8 Multi-Role Users

**Finding:** Multi-role users are common in this business.

| Scenario | Example |
|----------|---------|
| Client + Supplier | Sawmill buys logs from TW, sells boards to TW |
| Client + Producer | Factory produces for TW, also buys materials for own production |
| Supplier + Producer | Sawmill supplies boards AND does kiln drying as a service |

**Decision:** One user can have multiple roles, sees all their functions combined.

### 2.9 Portal Architecture Decision

**DECISION: Option B - One Portal, Function-Based Access**

After analysis, decided on ONE portal application for all users:

```
apps/
├── marketing/        ← Public website (no login)
└── portal/           ← ONE portal for ALL users
                        Function-based permissions per user
```

**Rationale:**
- Simpler codebase (one app to maintain)
- Handles multi-role users naturally
- Consistent UI pattern everywhere
- Flexible permissions system
- Easier updates and maintenance

**UI Pattern:**

```
┌──────────────────────────────────────────────────────────────────┐
│  TIMBER WORLD PORTAL                               [User Menu ▼] │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  FUNCTIONS │                                                     │
│  (sidebar) │           MAIN CONTENT AREA                         │
│            │                                                     │
│  [Function]│     Shows selected function's content               │
│  [Function]│                                                     │
│  [Function]│     Same UI structure for all users                 │
│  [Function]│     Different functions visible per user            │
│  [...    ] │                                                     │
│            │                                                     │
│  Only shows│                                                     │
│  functions │                                                     │
│  user has  │                                                     │
│  access to │                                                     │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

**Permission Model:**

```
USER
├── Has one or more ROLES (client, supplier, producer, admin)
│
└── Each ROLE has FUNCTIONS that can be toggled ON/OFF
    │
    └── Each FUNCTION may have SUB-PERMISSIONS
        (e.g., view only vs edit, limited data vs full data)
```

---

## Design Principles Discovered

### Principle #1: UNIFORMITY (Stage-Agnostic & Ownership-Agnostic)

The platform must handle all stages and ownership types with the same interfaces.

| What | Principle |
|------|-----------|
| **Suppliers** | Same portal regardless of what stage they supply |
| **Producers** | Same portal regardless of owned/partner/outsourced |
| **Products** | Same data structure regardless of processing stage |
| **Sales** | Same interface regardless of what's being sold |

### Principle #2: FEATURE-BASED ACCESS (All Portals)

Not just Admin - ALL portals have toggleable features per user/company.

```
Features can be:
├── Always ON (basic features)
├── Toggleable per client/supplier/producer type
├── Priority ordered (required vs optional fields)
└── Customizable per organization
```

### Principle #3: REPLACE THEIR SYSTEMS

The platform should be so good that partners USE IT instead of their own internal systems.

**Value Proposition:** Timber World provides partners with better technology than they have internally, making them want to work with Timber World.

### Principle #4: MULTI-LEVEL ACCESS WITHIN ORGANIZATIONS

Each company can have multiple users with different access levels:

```
SUPPLIER COMPANY
├── Owner/Manager → Full access: orders, invoices, payments
├── Sales Contact → Orders, communication, delivery
└── Production Manager → Order details, quality specs (NO financials)
```

### Principle #5: QUALITY DOCUMENTATION IS CENTRAL

Photos and specifications flow both directions between all parties.

```
Upload: Production photos, quality evidence
Download: Quality specifications, reference photos, acceptance criteria
Confirm: Mutual agreement that specs are understood
```

### Principle #6: ONE PORTAL, FUNCTION-BASED ACCESS

One portal application serves all user types. Users see functions based on their roles and permissions.

```
ONE PORTAL APP
├── Client logs in → sees Client functions
├── Supplier logs in → sees Supplier functions
├── Producer logs in → sees Producer functions
├── Admin logs in → sees Admin functions
└── Multi-role user → sees combined functions from all their roles

Benefits:
├── Simple codebase (one app)
├── Multi-role users work naturally
├── Consistent UI everywhere
├── Flexible permission system
└── Easier maintenance
```

---

## Open Questions

### To Be Answered:

1. **Data Model** (Area 3)
   - What entities need to be tracked?
   - How do orders flow through the system?
   - How is inventory tracked across locations?

2. **Integration Points** (Area 4)
   - ERP integration needed?
   - Accounting system integration?
   - Logistics/shipping integration?

3. **MVP Prioritization** (Area 5)
   - Which functions to build first?
   - What's the minimum viable feature set?
   - Database first or UI first?

---

## Session Log

| Time | Topic | Status |
|------|-------|--------|
| Session Start | Business Model Deep Dive | ✅ Complete |
| Q1.1-1.3 | Revenue, Raw Materials, Orchestrator Model | ✅ Answered |
| Q1.4-1.6 | Production Stages, Factory Types, Trading | ✅ Answered |
| Q2.1-2.3 | Client Types, Supplier Types, Internal Team | ✅ Answered |
| Q2.4-2.5 | Client Portal, Client's Dream | ✅ Answered |
| Q2.6-2.7 | Supplier Portal, Producer Portal | ✅ Answered |
| Q2.8 | Admin Portal Functions | ✅ Answered |
| Q2.9 | Portal Architecture Decision | ✅ Decided: Option B (One Portal) |

---

*This document is updated incrementally during the analysis session.*
