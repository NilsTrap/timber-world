---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
inputDocuments:
  - '_bmad-output/analysis/platform-deep-analysis-2026-01-20.md'
  - '_bmad-output/analysis/platform-vision-capture-2026-01-20.md'
date: 2026-01-20
author: Nils
---

# Product Brief: Timber World Platform

## Executive Summary

Timber World is a "Production Orchestrator" - a company that owns and controls timber through the entire supply chain, coordinating production across owned and partner facilities to deliver quality wood products to B2B customers across Europe.

**The Problem:** With a 3-person team managing suppliers, producers, and clients entirely through email, WhatsApp, phone calls, and Google Sheets, Timber World has hit a scaling ceiling. Every order - regardless of size - requires the same manual workflow: quotation, purchase order, contract, signature collection, production order, and producer coordination. This consumes 90% of team time, makes small orders uneconomical, and creates a growth trap where more business requires more headcount before generating more revenue. Salespeople spend their time on administrative tasks instead of finding and nurturing clients.

**The Solution:** The Timber World Platform - a B2B supply chain system that automates operational workflows and provides self-service portals for all parties. Suppliers, producers, clients, and salespeople interact directly with the platform, eliminating manual communication bottlenecks. The system handles quotes, orders, production tracking, inventory, documents, and payments - freeing the team to focus on sales and network expansion.

**The Outcome:** Scale from dozens to hundreds of partners and clients without proportional headcount growth. Transform small orders from a burden into viable business. Achieve complete visibility and control while reducing operational effort by 90%. Enable salespeople to focus on selling, not administration.

---

## Core Vision

### Problem Statement

Timber World operates as a production orchestrator, managing the flow of timber from suppliers through production facilities to B2B clients. The current operational model relies entirely on manual communication (email, WhatsApp, phone) and fragmented tools (Google Sheets, Google Drive) to coordinate this supply chain.

Every client order triggers a cascade of manual tasks:
1. Create and send quotation
2. Prepare purchase order for supplier
3. Draft contract specification
4. Update tracking spreadsheets
5. Send documents for signature
6. Receive signed documents
7. Create production order
8. Send production order to producer
9. Track progress via messages
10. Coordinate delivery and documentation

This same workflow executes whether the order is worth €500 or €50,000 - making small orders economically unviable and large orders administratively overwhelming.

**Salespeople are trapped:** Instead of finding new clients and growing relationships, they spend their time creating manual quotes, chasing signatures, tracking orders, and following up on production status. The lack of a unified system means data is scattered, tasks are easily forgotten, and errors creep in.

### Problem Impact

- **Time consumed:** 90% of team capacity goes to repetitive operational tasks
- **Scaling blocked:** Cannot grow beyond current partner/client base without adding headcount
- **Small orders rejected:** Fixed overhead per order makes small business uneconomical
- **Errors inevitable:** Manual data entry across multiple systems introduces mistakes
- **Visibility limited:** No real-time view of inventory, production status, or order progress
- **Wasted effort:** When production fails or orders cancel, all manual preparation is lost
- **Growth trap:** More orders → more people needed → higher costs → need even more orders
- **Sales inefficiency:** Salespeople do admin instead of selling; no single system for CRM, quotes, and order tracking

### Why Existing Solutions Fall Short

**Current approach (manual + spreadsheets):**
- Every action requires human effort
- No automation of repetitive workflows
- No self-service for partners or clients
- Data scattered across email, sheets, and chat histories
- No real-time visibility into operations
- Salespeople must manually track their pipeline and activities

**Generic ERP systems:**
- Built for traditional manufacturing, not production orchestration
- Don't handle the "orchestrator" model (coordinating external facilities)
- Complex, expensive, and designed for larger organizations
- Don't provide partner/client self-service portals
- CRM usually separate or poorly integrated

**Standalone CRM systems (like Pipedrive):**
- Good for pipeline tracking
- But disconnected from inventory, quotes, orders, production
- Salespeople still need to jump between systems
- No visibility into what happens after the sale

**No existing solution** addresses the specific needs of a timber production orchestrator managing a network of external suppliers and producers while serving B2B clients - with integrated sales tools.

### Proposed Solution

**The Timber World Platform** - a purpose-built B2B supply chain system with:

1. **Unified Portal Architecture**
   - One portal application with function-based access
   - **Clients** see ordering, tracking, invoices
   - **Suppliers** see orders, deliveries, payments
   - **Producers** see production orders, inventory, efficiency
   - **Sales** see CRM, quotes, client orders, pipeline
   - **Admins** see everything with full control
   - Multi-role users supported (same person can have multiple roles)

2. **Automated Workflows**
   - Client quote request → automatic pricing (where possible)
   - Approved quote → automatic PO to supplier
   - Materials received → automatic production order
   - Production complete → automatic client notification
   - Documents (invoices, CMRs, packing lists) generated automatically

3. **Self-Service for All Parties**
   - Clients: browse catalog, reorder, track shipments, view invoices
   - Suppliers: confirm orders, report deliveries, submit invoices
   - Producers: accept jobs, report progress, log material usage
   - Sales: create quotes, manage pipeline, track client orders

4. **Integrated Sales & CRM**
   - Full CRM functionality built into the platform (replaces Pipedrive)
   - Pipeline tracking with deals and stages
   - Contact management with communication history
   - Email integration (Gmail) for tracking all correspondence
   - Activity logging (calls, meetings, follow-ups)
   - Quote creation connected to real inventory and pricing
   - Order status visible without chasing operations

5. **Complete Visibility**
   - Real-time inventory at all locations
   - Production status and efficiency metrics
   - Cost tracking and margin analysis
   - Quality documentation with photos
   - Sales performance and pipeline analytics

### Key Differentiators

1. **Built for Production Orchestrators**
   - Designed for companies that coordinate rather than own all production
   - Handles the complexity of external supplier and producer networks
   - Supports entry/exit at any production stage

2. **Platform as Partner Advantage**
   - System so good that suppliers and producers prefer working with Timber World
   - Better technology than partners have internally
   - Transparency and efficiency benefit all parties

3. **Automation-First Design**
   - Default is automatic; human intervention is the exception
   - Small orders viable because system effort is near-zero
   - Team freed for high-value activities (sales, relationships, quality)

4. **Sales-Operations Integration**
   - CRM, quotes, orders, and production in ONE system
   - Salespeople see order status without asking operations
   - No data re-entry or system jumping
   - Pipeline connected to real inventory and delivery timelines

5. **Single Source of Truth**
   - One database, multiple interfaces
   - No more scattered spreadsheets and email threads
   - Real-time accuracy across all parties

6. **Phased, Practical Approach**
   - MVP focused on highest-pain production tracking
   - Build value incrementally, not big-bang deployment
   - Learn and adapt as real usage reveals needs

---

## Target Users

### Primary Users

#### Persona 1: "Erik" - The Furniture Producer

**Profile:**
- Runs a custom furniture workshop (5-50 employees)
- Makes tables, cabinets, or custom furniture pieces
- Based in Nordic countries, UK, or Ireland
- Needs regular monthly supply of solid wood panels and/or finished elements

**Needs & Motivations:**
- Reliable supply of quality oak panels to keep production running
- Competitive pricing (raw materials = core business cost)
- Flexibility: sometimes just panels, sometimes cut-to-size, CNC'd, or varnished elements
- Consistency: same quality month after month

**Current Frustrations:**
- Has existing suppliers, but may face quality issues or high prices
- No visibility into order status - has to email/call to check
- Reordering is manual - has to look up old orders and recreate

**What Success Looks Like:**
- Finds a single partner who can supply everything from basic panels to finished components
- Better price than current supplier
- Consistent quality without surprises
- Easy reordering process - one click to repeat last month's order
- Real-time visibility into production and delivery status

---

#### Persona 2: "Anna" - The Installation Professional

**Profile:**
- Runs installation business: stairs, kitchen tops, or similar
- Team size varies: small crew (5-10) to large operations (hundreds)
- Project-based work across region or country
- Needs parts for installation jobs - either stock or project-specific

**Needs & Motivations:**
- Two modes of buying:
  - **Stock mode:** Buy standard sizes in bulk, store, cut on-site as needed (better margins)
  - **Project mode:** Send exact specs, receive complete CNC'd/varnished package ready for installation
- Price advantage over local DIY shops
- Reliability: parts must arrive on time for scheduled installations

**Current Frustrations:**
- Often buys locally from DIY shops (convenient but expensive)
- Custom project quotes take too long
- No easy way to track when project orders will be ready

**What Success Looks Like:**
- Dramatic cost savings vs. local suppliers
- For project orders: receive complete ready-to-install packages
- Fast quotes for custom work
- Track delivery status without calling

---

#### Persona 3: "Viktor" - The Producer (Factory Manager)

**Profile:**
- Manages a panel manufacturing facility or processing factory
- Could be owned by Timber World, a partner, or outsourced
- Receives raw materials from Timber World, produces finished goods
- Responsible for production efficiency and quality

**Needs & Motivations:**
- Clear production orders with specifications
- Know what raw materials are available at his facility
- Track efficiency and waste to optimize operations
- Report production status without constant phone calls
- Get paid on time

**Current Frustrations:**
- Receives orders via email/WhatsApp - easy to miss details
- No system to track what inventory is at his facility
- Reports production manually - time consuming
- No visibility into efficiency trends

**What Success Looks Like:**
- All orders in one place with clear specs and photos
- Real-time inventory visibility
- Easy production reporting from phone on factory floor
- Efficiency dashboards to improve operations
- System so good he prefers it over his own internal tools

---

#### Persona 4: "Lars" - The Supplier

**Profile:**
- Runs a sawmill, kiln operation, or logging company
- Supplies raw materials or semi-finished goods to Timber World
- Long-term relationship (years, not transactions)
- May supply one product type or multiple stages

**Needs & Motivations:**
- Steady orders from reliable buyer
- Clear communication on what's needed and when
- Fast payment after delivery
- Transparency on order status and payment status

**Current Frustrations:**
- Orders come via email - has to dig through inbox
- Invoicing is manual - sends PDFs, waits for confirmation
- No visibility into payment status without asking
- Delivery coordination via phone calls

**What Success Looks Like:**
- All orders visible in one dashboard
- Submit delivery notifications and invoices through system
- See payment status in real-time
- Reduce time spent on admin, focus on production

---

#### Persona 5: "Johan" - The Purchase Manager

**Profile:**
- Internal Timber World employee, or external based in supplier countries
- Responsible for procurement: finding suppliers, placing orders, managing relationships
- Currently one person, future: many across countries where raw materials are sourced
- Specialized role focused on the buying side of the business

**Needs & Motivations:**
- Find reliable suppliers with good quality and pricing
- Place purchase orders efficiently
- Track incoming deliveries and inventory levels
- Manage supplier relationships and performance
- Arrange transport for raw materials
- Know when to reorder based on inventory and production needs

**Current Frustrations:**
- Data scattered across email, spreadsheets, WhatsApp
- Manual creation of purchase orders for each supplier
- No single view of all supplier orders and deliveries
- Chasing suppliers for delivery updates via phone/email
- No visibility into supplier performance over time
- Transport arrangement is manual and time-consuming

**What Success Looks Like:**
- One system for all supplier management and procurement
- Create purchase orders in minutes with real inventory data
- Real-time tracking of all incoming deliveries
- Supplier performance dashboards
- Automated alerts when inventory is low
- Future: AI assists with supplier discovery and communication

---

#### Persona 6: "Max" - The Sales Agent

**Profile:**
- Could be internal employee, external agent, or partner company rep
- Responsible for finding new clients and managing existing relationships
- Geographically distributed - may be in UK, Norway, Sweden, etc.
- Commission-based or salary, varies by arrangement

**Needs & Motivations:**
- Find and close new clients
- Keep existing clients happy and reordering
- Create quotes quickly and accurately
- Know order status without chasing operations
- Track his pipeline and activities

**Current Frustrations:**
- Data scattered across email, WhatsApp, spreadsheets
- Creating quotes takes hours of manual work
- No visibility into what happens after sale closes
- Forgets follow-ups because no reminder system
- Spends more time on admin than selling

**What Success Looks Like:**
- One system for everything: CRM, quotes, orders, communication
- Create quotes in minutes connected to real inventory
- See order status instantly without asking anyone
- Never miss a follow-up with automated reminders
- Spend 80% of time selling, not 20%

---

### Secondary Users

#### Persona 7: "Katja" - The Operations Manager (Admin)

**Profile:**
- Internal Timber World staff
- Manages day-to-day operations: orders, suppliers, producers, logistics
- Currently one person doing multiple roles
- Future: could be specialized team members

**Needs & Motivations:**
- Full visibility across all operations
- Manage orders from clients, to suppliers, to producers
- Track inventory across all locations
- Resolve quality issues and complaints
- Keep everything running smoothly

**Current Frustrations:**
- Information scattered across spreadsheets and email
- Manual coordination with every party
- No real-time visibility - has to ask for updates
- Errors from manual data entry

**What Success Looks Like:**
- Single dashboard showing all operations
- Automated workflows reduce manual work by 90%
- Real-time alerts for issues needing attention
- Time freed for strategic work, not data entry

---

#### Persona 8: "Nils" - The Executive (Owner)

**Profile:**
- Company owner/executive
- Needs strategic overview, not day-to-day details
- Makes decisions on pricing, partnerships, expansion
- Responsible for overall business health

**Needs & Motivations:**
- KPI dashboard at a glance
- Margin and profitability visibility
- Alerts only for things needing executive attention
- Strategic reports for planning

**What Success Looks Like:**
- Know business health in seconds, not hours
- Confident that operations run without constant oversight
- Data-driven decisions on pricing and partnerships
- Time for growth strategy, not firefighting

---

### User Journey

**Discovery Phase:**

| User Type | How They Find Timber World |
|-----------|---------------------------|
| Clients | Sales agent outreach, marketing website, referrals, trade shows |
| Suppliers | Timber World reaches out for partnerships |
| Producers | Timber World contracts for production capacity |
| Sales | Hired or contracted by Timber World |
| Purchase | Hired by Timber World or contracted in supplier regions |

**Onboarding Phase:**

| User Type | First Experience |
|-----------|-----------------|
| **Clients** | Visit marketing site → Request quote → Sales follow-up → First deal → Receive portal login → Become regular user |
| Suppliers | Receive login → See first order → Confirm and deliver |
| Producers | Receive login → See inventory at facility → Report first production |
| Sales | Receive login → Import/enter clients → Create first quote |
| Purchase | Receive login → Import/enter suppliers → Create first purchase order |

**Client Journey Detail:**
```
1. Discovery: Find Timber World (marketing site, agent, referral)
       │
       ▼
2. First Contact: Submit quote request on marketing site
       │
       ▼
3. Sales Engagement: Agent follows up, negotiates, closes deal
       │
       ▼
4. First Order: Delivered, quality confirmed
       │
       ▼
5. Portal Access: Receive login credentials
       │
       ▼
6. Regular Client: Reorder, track, self-service through portal
```

**Core Usage (Day-to-Day):**

| User Type | Primary Actions |
|-----------|----------------|
| Clients | Reorder, track orders, view invoices |
| Suppliers | Confirm orders, report deliveries, submit invoices |
| Producers | Accept jobs, report progress, log materials |
| Sales | Manage pipeline, create quotes, track client orders |
| Purchase | Create POs, track deliveries, manage suppliers |
| Admins | Oversee operations, resolve issues, run reports |

**"Aha!" Moment:**

| User Type | When They Realize Value |
|-----------|------------------------|
| Clients | First reorder takes 30 seconds instead of 30 minutes |
| Suppliers | Payment status visible without asking |
| Producers | Efficiency report shows where to improve |
| Sales | Quote created in 5 minutes, client approves same day |
| Purchase | PO created in 5 minutes, delivery tracked automatically |
| Admins | Morning takes 10 minutes instead of 2 hours |

---

## Success Metrics

### Primary Success Indicator

**Real-time Inventory Visibility**
> "I can see what inventory I sent to producers, what they made from it, what's the output, and current inventory levels everywhere - in real-time, without asking anyone."

This is the #1 indicator that the platform is working. When this is true, the core value is delivered.

---

### User Success Metrics

| User Type | Success Indicator | Target |
|-----------|------------------|--------|
| **Producers** | Report production through portal (input → output) | 100% of jobs tracked in system |
| **Producers** | Inventory at their facility visible in real-time | Always accurate within same day |
| **Suppliers** | Orders and invoices through portal | No email back-and-forth needed |
| **Clients** | Documents and project orders through portal | Email → portal transition complete |
| **Sales** | Quotes created in system with real inventory data | <10 minutes per quote |
| **Admins** | All operations visible in one dashboard | Morning check <15 minutes |

**User Success Definition:**
> Each user type can do their core job through the portal without reverting to email/WhatsApp/phone for standard tasks.

---

### Business Objectives

| Timeframe | Objective | Success Criteria |
|-----------|-----------|------------------|
| **Month 1** | Production tracking live | 2-3 producers using portal, inventory tracked in real-time |
| **Month 1** | Basic client portal | Clients can submit documents, invoices, project orders through portal |
| **Month 2** | Supplier portal live | Suppliers confirm orders and submit invoices through system |
| **Month 3** | Sales CRM functional | Salespeople create quotes and manage pipeline in system |
| **Month 4** | Automation workflows | Order → PO → Production order flows automatically |
| **Month 6** | Full platform operational | All user types on portal, 10x capacity without adding ops staff |

---

### Key Performance Indicators (KPIs)

**Operational Efficiency:**

| KPI | Current | Target (Month 6) |
|-----|---------|------------------|
| Time spent on ops tasks per order | ~90% of total time | <10% of total time |
| Orders manageable per person | ~10-20/month | 100+/month |
| Minimum viable order size | Large orders only | Any size viable |

**Platform Adoption:**

| KPI | Month 1 | Month 3 | Month 6 |
|-----|---------|---------|---------|
| Producers on portal | 2-3 | All active | All active |
| Clients on portal | First few | 50% | 80%+ |
| Suppliers on portal | - | First few | 50%+ |
| Sales using CRM | - | 100% | 100% |

**Data Accuracy:**

| KPI | Target |
|-----|--------|
| Inventory accuracy (system vs reality) | >95% |
| Order status visible in real-time | 100% |
| Production efficiency tracked | All producers |

---

### What Cannot Be Directly Measured (But Matters)

- **Partner preference:** Do suppliers/producers prefer working with Timber World because of the platform?
- **Competitive advantage:** Does the platform help win deals against competitors?
- **Peace of mind:** Can Nils sleep knowing operations run smoothly?

---

## MVP Scope

### Phase 1: Core Foundation (Month 1)

#### 1.1 Producer Portal (Highest Priority)

| Feature | Description |
|---------|-------------|
| Producer login | Secure authentication for factory users |
| View inventory at facility | See what raw materials TW sent them |
| Enter production | Report: input materials → output products |
| Submit production | Confirm production job complete |
| View efficiency | See their production efficiency % |
| View production history | Past jobs and metrics |

**Admin Functions for Producers:**

| Feature | Description |
|---------|-------------|
| Create producer accounts | Set up new factory users |
| Enter inventory sent | Record materials sent to producer |
| View inventory at each producer | Real-time stock visibility |
| View production efficiency reports | Compare producers |

#### 1.2 Basic Client Portal (Month 1)

| Feature | Description |
|---------|-------------|
| Client login | Secure authentication |
| Submit documents | Upload invoices, packing lists |
| Submit project orders | Send project specs and requirements |
| View order status | See where their order is |
| Communication | Messages with Timber World |

---

### Phase 2: Supplier Portal (Month 2)

| Feature | Description |
|---------|-------------|
| Supplier login | Secure authentication |
| View orders from TW | See purchase orders |
| Confirm orders | Accept/decline orders |
| Report delivery | Notify when shipped |
| Upload documents | Invoices, packing lists, CMRs |
| View payment status | See if paid |

---

### Phase 3: Sales CRM (Month 3)

| Feature | Description |
|---------|-------------|
| Sales login | Secure authentication |
| CRM pipeline | Deals and stages |
| Contact management | Companies, people, history |
| Create quotes | Connected to inventory/pricing |
| View client orders | Track order status |
| Activity logging | Calls, meetings, follow-ups |
| Email integration | Gmail sync for communication tracking |

---

### Phase 4: Automation (Month 4)

| Feature | Description |
|---------|-------------|
| Quote → Order flow | Approved quote creates order automatically |
| Order → PO flow | Client order triggers supplier PO |
| Materials → Production | Received materials trigger production order |
| Auto-notifications | Status updates sent automatically |
| Document generation | Invoices, CMRs generated from data |

---

### Out of Scope for MVP

| Feature | Reason | When |
|---------|--------|------|
| AI chatbot for quotes | Nice to have, not critical for operations | After Month 6 |
| Multi-language | English first, add languages later | After Month 6 |
| Mobile apps | Web portal works on mobile, native apps later | After Month 6 |
| Advanced analytics | Basic reports first, advanced later | After Month 6 |
| E-signatures | Manual signatures OK initially | Future |
| Bank/accounting integration | Manual export initially | Future |
| Marketing website updates | Existing site works for now | Separate project |

---

### MVP Success Criteria

**Launch Readiness (Month 1):**
- 2-3 producers actively using portal
- Inventory tracked in real-time at producer facilities
- At least 1 client submitting documents through portal
- Admin can see all inventory across locations

**Validation (Month 3):**
- All active producers on portal
- 50%+ of supplier transactions through system
- Sales creating quotes in system
- Reduction in email/WhatsApp coordination visible

**Full Platform (Month 6):**
- All user types using portal for daily work
- 90% reduction in manual operational tasks
- Small orders economically viable
- 10x capacity without adding ops staff

---

### Future Vision

**Near-term Enhancements (After Month 6):**
- AI-powered quotation assistant
- Multi-language support (Swedish, Norwegian, Finnish, etc.)
- Native mobile apps for factory floor
- Advanced analytics and forecasting
- Bank feed integration for payment matching

**Long-term Platform Evolution:**
- API for third-party integrations
- Partner white-label options
- Industry marketplace features
- Logistics partner integration
- Advanced AI for demand forecasting

---
