---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
skippedSteps: [5]
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-Timber-World-2026-01-20.md'
  - '_bmad-output/analysis/platform-deep-analysis-2026-01-20.md'
  - '_bmad-output/analysis/platform-vision-capture-2026-01-20.md'
workflowType: 'prd'
workflowComplete: true
lastStep: 11
date: 2026-01-21
completedDate: 2026-01-21
---

# Product Requirements Document - Timber World Platform

**Author:** Nils
**Date:** 2026-01-21

---

## Executive Summary

### Product Vision

**Timber World Platform** is a B2B supply chain system that transforms how a timber production orchestrator operates. The platform automates operational workflows and provides self-service portals for all parties - clients, suppliers, producers, sales agents, and purchase managers - eliminating manual communication bottlenecks that currently consume 90% of team capacity.

The platform enables Timber World to scale from dozens to hundreds of partners and clients without proportional headcount growth, making small orders economically viable and freeing the team to focus on sales and network expansion.

### Problem Statement

Timber World operates as a "Production Orchestrator" - controlling timber through the entire supply chain while coordinating production across owned and partner facilities. The current operational model relies entirely on manual communication (email, WhatsApp, phone) and fragmented tools (Google Sheets, Google Drive).

**Current Pain Points:**
- Every order triggers 10+ manual tasks regardless of size (€500 or €50,000)
- 90% of team time goes to repetitive operational tasks
- Data scattered across email, spreadsheets, and chat histories
- No real-time visibility into inventory, production, or order status
- Salespeople do admin instead of selling
- Small orders are uneconomical due to fixed overhead
- Growth trap: more orders → need more people → need more money

### Proposed Solution

A unified portal platform with function-based access serving 6 user roles:

| Role | Portal Functions |
|------|------------------|
| **Clients** | Order, reorder, track shipments, view invoices |
| **Suppliers** | View orders, confirm deliveries, submit invoices |
| **Producers** | Accept jobs, report production, track efficiency |
| **Sales** | CRM, create quotes, manage pipeline, track orders |
| **Purchase** | Find suppliers, create POs, track deliveries |
| **Admins** | Full oversight, analytics, approvals |

### What Makes This Special

1. **Built for Production Orchestrators** - Designed for companies that coordinate rather than own all production; handles the complexity of external supplier and producer networks

2. **Platform as Partner Advantage** - System so good that suppliers and producers prefer working with Timber World over competitors

3. **Automation-First Design** - Default is automatic; human intervention is the exception; small orders viable because system effort is near-zero

4. **Unified System** - CRM + Operations + Procurement in ONE platform (replaces Pipedrive, Google Sheets, email coordination)

5. **Network Effects as Competitive Moat** - Once suppliers and clients see real deals flowing through an automated system, they become locked in; competitors would need to build both the platform AND the network simultaneously

---

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Technical Type** | B2B SaaS Platform (`saas_b2b`) |
| **Domain** | Supply Chain / Manufacturing |
| **Complexity** | Medium-High |
| **Project Context** | Greenfield - new platform |

**Key Technical Considerations:**
- Multi-tenant architecture (clients, suppliers, producers as separate organizations)
- Role-based access control with function toggles per user
- Real-time inventory tracking across multiple locations
- Production transformation tracking (input → output)
- Document workflow automation (quotes, POs, invoices, CMRs)
- Future AI integration (automated procurement, quote generation)

---

## Success Criteria

### User Success

Each user type achieves their core workflow through the portal without reverting to email/WhatsApp/phone for standard tasks:

| User Type | Success Indicator | "Aha!" Moment |
|-----------|------------------|---------------|
| **Producers** | Report production input→output through portal; inventory visible in real-time | Efficiency report shows where to improve |
| **Suppliers** | Orders and invoices through portal; payment status visible | Payment status visible without asking |
| **Clients** | Documents, project orders, reorders through portal | First reorder takes 30 seconds instead of 30 minutes |
| **Sales** | Quotes created in system with real inventory data; pipeline managed | Quote created in 5 minutes, client approves same day |
| **Purchase** | POs created with real inventory data; deliveries tracked | PO created in 5 minutes, delivery tracked automatically |
| **Admins** | All operations visible in one dashboard | Morning check takes 10 minutes instead of 2 hours |

### Business Success

**Primary Success Indicator:**
> "I can see what inventory I sent to producers, what they made from it, what's the output, and current inventory levels everywhere - in real-time, without asking anyone."

| Timeframe | Objective | Success Criteria |
|-----------|-----------|------------------|
| **Month 1** | Production tracking live | 2-3 producers using portal, inventory tracked in real-time |
| **Month 1** | Basic client portal | Clients can submit documents and project orders through portal |
| **Month 2** | Supplier portal live | Suppliers confirm orders and submit invoices through system |
| **Month 3** | Sales CRM functional | Salespeople create quotes and manage pipeline in system |
| **Month 4** | Automation workflows | Order → PO → Production order flows automatically |
| **Month 6** | Full platform operational | All user types on portal, 90% reduction in manual tasks |

### Technical Success

| KPI | Current State | Target (Month 6) |
|-----|---------------|------------------|
| Inventory accuracy (system vs reality) | Unknown (manual) | >95% |
| Order status visibility | Via email/phone | 100% real-time |
| Production efficiency tracking | Manual spreadsheets | All producers tracked |

### Measurable Outcomes

**Operational Efficiency:**

| Metric | Current | Target (Month 6) |
|--------|---------|------------------|
| Time spent on ops tasks per order | ~90% of total time | <10% of total time |
| Orders manageable per person | ~10-20/month | 100+/month |
| Minimum viable order size | Large orders only | Any size viable |

**Platform Adoption:**

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Producers on portal | 2-3 | All active | All active |
| Clients on portal | First few | 50% | 80%+ |
| Suppliers on portal | - | First few | 50%+ |
| Sales using CRM | - | 100% | 100% |
| Purchase using portal | - | 100% | 100% |

**Network Effect Indicators (Competitive Moat):**

| Indicator | How to Measure |
|-----------|----------------|
| Partner preference | Suppliers/producers express preference for Timber World system |
| Lock-in evidence | Partners integrate workflows around Timber World portal |
| Deal velocity | Time from quote to closed deal decreases |
| Repeat business | Client reorder frequency increases |

---

## Product Scope

### MVP - Minimum Viable Product (Month 1-2)

**Must have for launch:**
- Producer Portal: inventory visibility, production reporting, efficiency tracking
- Client Portal: document submission, project orders, order status
- Admin functions: producer management, inventory oversight
- Supplier Portal: order viewing, delivery confirmation, invoice submission

**Not MVP but essential for validation:**
- Basic sales CRM: pipeline, quotes, client visibility (Month 3)
- Purchase management: POs, supplier tracking (Month 3)

### Growth Features (Post-MVP, Month 4-6)

| Feature | Purpose |
|---------|---------|
| Automation workflows | Order → PO → Production automatic flow |
| Document generation | Auto-create invoices, CMRs, packing lists |
| Email integration | Gmail sync for communication tracking |
| Advanced reporting | Producer comparisons, margin analysis |

### Vision (Future, Post-Month 6)

| Feature | When |
|---------|------|
| AI-powered quotation assistant | After Month 6 |
| Multi-language support | After Month 6 |
| Native mobile apps | After Month 6 |
| Bank/accounting integration | Future |
| API for third-party integrations | Future |
| Advanced AI for demand forecasting | Long-term |

### Explicitly Out of Scope for MVP

| Feature | Reason |
|---------|--------|
| AI chatbot for quotes | Not critical for operations |
| Multi-language | English first |
| Native mobile apps | Web portal works on mobile |
| E-signatures | Manual signatures OK initially |
| Marketing website updates | Separate project |

---

## User Journeys

### Journey 1: Erik Lindqvist - The Furniture Producer Who Stopped Chasing

Erik runs a 12-person custom furniture workshop in Gothenburg. His team produces beautiful oak dining tables and cabinets, but lately he's been spending more time on the phone than at his workbench. Every month it's the same routine: dig through old emails to find last order's specifications, call Timber World to check if oak panels are available, wait for a quote, negotiate, wait again for delivery updates, then hope the quality matches what he ordered last time.

One Tuesday, he receives an email from his sales contact Max with a link to the new Timber World client portal. Skeptical but curious, Erik logs in during his lunch break. What he sees surprises him - his complete order history, exactly what he ordered 6 months ago when production went perfectly. He clicks "Reorder" and in 30 seconds, the order is placed with the same specs, same quality, same everything.

The breakthrough comes three weeks later. His team is mid-production on a large restaurant project when they realize they'll need additional panels. Instead of the usual panic - calling, waiting, uncertainty - Erik opens the portal on his phone, sees the panels are in stock, places the order, and tracks delivery in real-time. The panels arrive exactly when the system said they would.

By month three, Erik has increased his production capacity by 20% - not because he hired anyone, but because he's no longer the bottleneck for ordering materials. He tells other workshop owners about "the Swedish company with the system that actually works."

---

### Journey 2: Anna Bergström - The Installer Who Gained Predictability

Anna manages a 40-person stair installation company operating across southern Sweden. Her business runs on tight schedules - a delayed delivery means a crew standing idle on-site, angry customers, and cascading schedule chaos. Currently, she orders custom-cut stair components project by project, each time sending detailed specs via email, waiting days for quotes, and having no idea when materials will actually arrive until they're almost there.

Her introduction to the portal comes after a particularly frustrating project where materials arrived 3 days late. Max, her sales contact, offers to set her up on the new system. "I've heard this before," she thinks, but agrees to try.

The first test is a complex curved staircase project. Anna uploads her CAD specifications through the portal. Within hours (not days), she has a quote. She approves it and immediately sees an estimated production date. She can see when the order enters production, when it's completed, when it ships. She shares the tracking link with her site manager who can plan the crew schedule with confidence.

The transformation happens over the next quarter. Anna's operations manager realizes they're spending 70% less time on order coordination. More importantly, their on-time installation rate jumps from 78% to 96%. Anna starts taking on more complex projects - the ones she used to avoid because of coordination risk. Her profit margins improve not because prices changed, but because predictability eliminated waste.

---

### Journey 3: Viktor Johansson - The Factory Manager Who Proved His Value

Viktor manages a panel processing facility in Estonia that produces for several trading companies, including Timber World. His daily reality is chaos management - orders arrive via WhatsApp, sometimes email, occasionally phone calls. He tracks production in a spreadsheet his predecessor created. When Timber World asks "what happened to that oak we sent last month?", Viktor spends an hour reconstructing records from memory and paper notes.

When Timber World introduces the producer portal, Viktor is initially resistant - another system to learn, probably won't work with his process. But his first login changes his mind. There's a clear list of raw materials Timber World has sent to his facility. Not scattered across messages, but in one place, updated automatically.

Viktor starts logging production through the system - input materials, output products, waste. Simple data entry on his phone while walking the floor. Within two weeks, he has something he never had before: data. The system shows his facility runs at 82% efficiency. Not bad, but he spots a pattern - efficiency drops every Monday morning. He investigates and finds the kiln takes longer to stabilize after the weekend shutdown. A simple process change pushes efficiency to 87%.

Three months later, Viktor uses his efficiency dashboards in a negotiation with Timber World. His data shows consistent quality and improving efficiency. He secures better terms. The system that felt like oversight became his competitive advantage. He now recommends it to other producers who want to prove their value rather than just claim it.

---

### Journey 4: Lars Petersson - The Sawmill Owner Who Got Paid Faster

Lars runs a family sawmill in northern Sweden, the third generation to do so. His business relationship with Timber World spans a decade - good people, fair prices, but the paperwork is exhausting. Purchase orders come by email (when they remember to send them), he ships the timber, sends an invoice as a PDF, then waits. Sometimes payment takes 45 days. Sometimes 60. He never knows when to expect it without calling.

The supplier portal arrives as a simple invitation email. Lars opens it expecting complexity but finds simplicity. There's a list of orders from Timber World - current, pending, completed. He clicks on a completed order and sees something remarkable: payment status. "Approved for payment - scheduled Feb 15." No phone call needed. No uncertainty.

Lars starts using the system to confirm deliveries. When a truck leaves his facility, he logs it in the portal with the delivery note. Timber World sees it immediately - no waiting for paperwork to arrive. Invoice submission moves from email attachment to system upload, instantly matched to the delivery.

The real change shows up in his cash flow. Average payment time drops from 52 days to 28 days - not because Timber World pays faster, but because the paperwork delays disappear. Lars spends his saved admin time doing what he actually enjoys: being in the forest selecting timber, not in the office managing paper.

---

### Journey 5: Johan Eriksson - The Purchase Manager Who Scaled Without Stress

Johan is Timber World's first dedicated purchase manager, promoted from operations after the company realized procurement needed focus. His job: find suppliers, negotiate prices, place orders, and ensure raw materials arrive when production needs them. Armed with spreadsheets and a phone, he manages relationships across Sweden, Finland, and the Baltics.

His morning routine before the portal: check emails for supplier responses, update the master spreadsheet with delivery estimates, call suppliers who haven't responded, check another spreadsheet for inventory levels, decide what to order based on gut feeling and memory. By 10am, he's exhausted and hasn't placed a single order.

With the purchase portal, Johan's morning transforms. He opens one dashboard that shows: current inventory levels at each producer facility, incoming deliveries, orders pending confirmation. Red flags highlight potential shortages two weeks out - before they become emergencies. He creates a purchase order in the system, selects the supplier, and sends it with one click. The supplier confirms through their portal, and Johan sees it immediately.

Six months later, Timber World's supplier network has doubled. Johan manages twice the volume with the same effort. When asked about adding a second purchase manager, he replies: "Not yet. The system does the coordination. I focus on relationships and finding new suppliers. That's where the real value is."

---

### Journey 6: Max Lindgren - The Sales Agent Who Started Selling

Max joined Timber World as a sales agent in the UK market, excited to build relationships and close deals. Reality hit hard: 60% of his time goes to administration. Creating quotes manually (copy-paste from old quotes, manually check inventory, format in Word), chasing signatures, asking operations about order status, updating his personal CRM spreadsheet. By Friday, he's done more admin than selling.

The sales portal changes everything. Max logs in Monday morning and sees his pipeline - deals, stages, next actions. He has a warm lead who needs a quote. Instead of his usual 2-hour quote creation process, he selects products from the catalog (real-time inventory visible), the system calculates pricing based on the client's tier, and generates a professional quote PDF. Ten minutes.

The client has questions about delivery timing. In the old days, Max would email operations and wait hours. Now he checks the production schedule in his portal and answers immediately: "We can deliver week 12." The client approves. Max converts the quote to an order with one click - it flows automatically to operations.

By month three, Max has increased his active pipeline by 40%. His conversion rate improved because he follows up faster, answers questions immediately, and never loses track of a lead. When Timber World expands the UK sales team, Max trains the new hires: "The system handles the admin. Your job is to talk to customers." Exactly how it should be.

---

### Journey 7: Katja Nilsson - The Operations Manager Who Finally Slept

Katja is Timber World's operations manager - which really means she's the person everyone calls when something goes wrong. Her phone buzzes constantly: producers asking about orders, suppliers confirming deliveries, sales asking about status, the boss asking about inventory. She lives in reactive mode, putting out fires she often could have prevented if she'd had time to look ahead.

Her morning before the platform: open Gmail (47 unread), scan for urgent issues, update the master operations spreadsheet, chase producers for updates via WhatsApp, answer sales questions about order status, repeat. By noon she's exhausted and hasn't done any proactive work.

The admin portal gives Katja something she never had: a single view of operations. One dashboard shows all orders, all inventory, all production status. Filters let her focus: "show me orders due this week that haven't started production." Three items appear. She clicks through - one producer hasn't confirmed. She sends a message through the system. Done.

The transformation isn't dramatic - it's cumulative. Each small thing that used to take 30 minutes now takes 3 minutes. Questions she used to field ("where's order #1234?") now have self-service answers. Producers report their own status. Suppliers confirm their own deliveries. Katja's role shifts from information relay to exception handler.

Three months later, Katja leaves work at 5pm most days. She spends her mornings on proactive planning instead of reactive firefighting. Her boss Nils comments that operations seems to "just work now." Katja smiles. It's not magic - it's having the right information at the right time.

---

### Journey 8: Nils Andersen - The CEO Who Regained Control

Nils founded Timber World 8 years ago, growing it from a one-man trading operation to a production orchestration company. He's proud of what he's built but increasingly worried about what he's lost: visibility. He doesn't really know if the company made money last month until accounting reconciles everything weeks later. He can't answer simple questions - "How much inventory do we have?" - without asking someone to dig through spreadsheets.

His introduction to the executive dashboard is almost anticlimactic. He logs in and sees... numbers. But they're the right numbers: total inventory value across all locations, orders in progress, orders completed this month, producer efficiency comparisons. Real-time. No asking. No waiting.

The first "aha" moment comes during a client call. The client asks about increasing their quarterly order. Old Nils would say "let me check with my team." New Nils glances at his dashboard: sufficient inventory, production capacity available. "Yes, we can do that." Confidence. Speed.

The strategic shift happens over the following months. With operational visibility handled by the system, Nils spends his time on growth: new market analysis, partnership discussions, pricing strategy. He's building the business instead of managing the chaos. When a potential investor asks about operations, Nils shares the dashboard. "This is how we run. Everything visible, everything tracked." The investor is impressed. Nils remembers why he started this company - to build something scalable. Now he finally can.

---

### Journey Requirements Summary

These journeys reveal the following capability areas required for the Timber World Platform:

| Journey | User Type | Key Capabilities Required |
|---------|-----------|--------------------------|
| **Erik** | Client | Order history, one-click reorder, real-time inventory visibility, delivery tracking |
| **Anna** | Client | Spec/file upload, fast quoting, production status visibility, delivery tracking, shareable links |
| **Viktor** | Producer | Inventory receiving, production logging (input→output), efficiency dashboards, mobile access |
| **Lars** | Supplier | Order viewing, delivery confirmation, invoice submission, payment status visibility |
| **Johan** | Purchase | Inventory dashboards, PO creation, supplier management, shortage alerts, delivery tracking |
| **Max** | Sales | CRM pipeline, quote generation with real inventory, order conversion, client order visibility |
| **Katja** | Admin | Unified operations dashboard, filters/search, exception alerts, cross-system visibility |
| **Nils** | Executive | KPI dashboard, real-time metrics, inventory totals, efficiency comparisons |

**Cross-Cutting Requirements Revealed:**

- **Real-time data sync** - Every user expects current information without refresh delays
- **Self-service** - Users answer their own questions instead of asking others
- **Mobile accessibility** - Factory floor, warehouse, on-site installation all need mobile access
- **Role-based views** - Same data, different perspectives based on user needs
- **Notification/alerts** - Proactive system notifications for exceptions and deadlines
- **Document generation** - Quotes, POs, invoices generated from system data
- **Audit trail** - Who did what, when, for accountability and debugging

---

## Innovation & Novel Patterns

### Detected Innovation Areas

The Timber World Platform contains several genuinely novel patterns that differentiate it from traditional ERP, supply chain, or marketplace software:

#### 1. The Production Orchestrator Model

**What's Novel:** Most timber industry software assumes the user owns production. Timber World inverts this - the orchestrator controls the supply chain without owning all facilities.

**Why It Matters:** Producers traditionally bear all risk: invest in raw materials, find buyers, then produce. The orchestrator model transfers this burden. Timber World supplies raw materials, brings clients, provides capital - producers focus purely on production efficiency. This is "IKEA mode" for timber: production partners with reduced risk and clear focus.

**Industry Gap:** This model isn't industry standard because most producers are vertically integrated. No one has built software specifically for orchestrating external production networks in timber.

#### 2. Network Effects as Competitive Moat

**What's Novel:** The platform creates many-to-many relationships that become more valuable as the network grows:
- One supplier can produce for many buyers
- One buyer can source from many suppliers
- Suppliers can combine specifications and use all raw materials efficiently
- Buyers can get exactly what they need from the optimal producer

**The Lock-In Mechanism:** As the network scales:
- Suppliers gain access to diverse demand they couldn't reach alone
- Buyers gain access to production capacity they couldn't negotiate alone
- Both sides benefit more from staying than leaving
- Competitors would need to build both the platform AND the network simultaneously

**Scale Dynamics:** The bigger the network, the bigger the advantage for everyone. A supplier working with only 1-2 buyers has limited utilization. A supplier connected to 50 buyers through Timber World maximizes their production capacity.

#### 3. Small Order Economics Revolution

**What's Novel:** Automation-first design makes small orders profitable rather than burdensome.

**Current Problem:** A small buyer (small furniture workshop, individual installer) cannot approach a large factory directly. The factory won't work with them because:
- Order is too small to justify setup/coordination costs
- Manual processing makes small orders unprofitable
- No relationship or trust established

**The Unlock:** With automated processing:
- Small orders can be matched to factories already producing similar products
- Factory adds incremental volume to existing production runs
- Buyer gets access to professional production at reasonable prices
- Factory earns extra margin on capacity they'd otherwise not use
- Timber World makes margin with near-zero processing effort

**Everyone Wins:**
- **Buyer:** Gets access to production they couldn't reach before, at competitive prices
- **Factory:** Gets incremental revenue with minimal disruption
- **Timber World:** Makes margin on orders that were previously impossible

**Growth Potential:** Small buyers who start with occasional orders can grow into significant clients over time - a customer acquisition channel that doesn't exist without automation.

### Market Context & Competitive Landscape

| Competitor Type | Why They Can't Replicate Easily |
|-----------------|--------------------------------|
| **Traditional ERP** | Built for companies that own production; doesn't handle external orchestration |
| **Marketplace platforms** | Transaction-focused, not production-orchestration focused; no inventory/quality control |
| **New entrants** | Would need to build both platform AND network simultaneously |
| **Producers' own systems** | Designed for their own production, not multi-party orchestration |

**First-Mover Advantage:** The network effects create a defensible position. Once suppliers and buyers experience value, switching costs are real - not because of contract lock-in, but because leaving means losing network access.

### Validation Approach

| Innovation | Validation Method |
|------------|-------------------|
| **Orchestrator Model** | Producer adoption - do they prefer working through TW vs. direct? |
| **Network Effects** | Track multi-party utilization - do suppliers serve multiple buyers through TW? |
| **Small Order Economics** | Measure profitability per order size tier - are small orders viable? |

**Key Metrics to Watch:**
- Average order size trend (should be able to decrease without hurting margins)
- Producer utilization rate through TW vs. their baseline
- Repeat business rate across all user types
- Time to process order (should decrease as automation increases)

### Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| **Network doesn't reach critical mass** | Focus on dense geographic/product clusters first; depth before breadth |
| **Producers don't adopt portal** | Make it so good they prefer it; start with 2-3 champions |
| **Small orders don't scale** | Prove unit economics with first 10 small orders before marketing broadly |
| **Competitors copy model** | Move fast; network effects compound; focus on execution speed |

### Strategic Implications

These innovations shape several product decisions:

1. **Build for network scale** - Architecture must support many-to-many relationships efficiently
2. **Automation is core, not optional** - Without near-zero processing cost, small order economics don't work
3. **Producer experience is critical** - If producers don't adopt, there's no production network to orchestrate
4. **Measure network health** - KPIs should track network density and multi-party utilization, not just transaction volume

---

## B2B SaaS Specific Requirements

### Platform Overview

The Timber World Platform is a B2B SaaS system operating as a **free utility platform** for all parties in the timber supply chain. Unlike traditional SaaS with subscription revenue, the platform generates value through:
- Enabling Timber World's core trading/orchestration business
- Building network effects that create competitive moat
- Making partners dependent on the platform for efficiency

### Multi-Tenant Architecture

#### Tenant Model

| Organization Type | Isolation Level | Data Visibility |
|-------------------|-----------------|-----------------|
| **Clients** | Full isolation | Own orders, invoices, communications only |
| **Suppliers** | Full isolation | Own orders from TW, deliveries, payments only |
| **Producers** | Full isolation | Own inventory, production jobs, efficiency data only |
| **Timber World** | Central hub | All data across all organizations |

**Hub-and-Spoke Communication Model:**

All communication flows through the central platform. No direct communication between external parties. External parties never see each other's data or existence. The system is the single source of truth for all relationships.

#### Data Isolation Requirements

| Requirement | Implementation |
|-------------|----------------|
| Row-level security | Every query filtered by organization_id |
| API isolation | Tokens scoped to specific organization |
| UI isolation | Each user sees only their organization's data |
| Audit isolation | Activity logs filtered by organization |
| Communication isolation | Messages routed through system, not peer-to-peer |

### Permission Model (RBAC)

#### Role-Based Access Control Matrix

| Capability | Client | Supplier | Producer | Sales | Purchase | Admin |
|------------|--------|----------|----------|-------|----------|-------|
| View own orders | ✓ | ✓ | ✓ | - | - | ✓ |
| Create orders | ✓ | - | - | ✓ | - | ✓ |
| View inventory | Limited | - | Own facility | ✓ | ✓ | ✓ |
| Report production | - | - | ✓ | - | - | ✓ |
| Confirm deliveries | - | ✓ | - | - | ✓ | ✓ |
| Submit invoices | - | ✓ | - | - | - | ✓ |
| Create quotes | - | - | - | ✓ | - | ✓ |
| Create POs | - | - | - | - | ✓ | ✓ |
| Manage pipeline | - | - | - | ✓ | - | ✓ |
| View all operations | - | - | - | - | - | ✓ |
| Manage users | - | - | - | - | - | ✓ |

#### Multi-Role Support

- Same user can have multiple roles (e.g., admin + sales)
- Permissions are additive across roles
- Organization membership is singular (user belongs to one org)

### Pricing Model

| Aspect | Decision |
|--------|----------|
| **Cost to users** | FREE for all parties |
| **Revenue model** | Platform enables Timber World's trading business |
| **Why free?** | Maximize adoption, build network effects, create switching costs |
| **Value exchange** | Users get efficiency; Timber World gets locked-in network |

**Strategic Rationale:**
- Every barrier to adoption (including cost) weakens network effects
- Partners who pay nothing have no reason NOT to use the platform
- Platform dependency creates competitive moat for Timber World's core business

### Integration Architecture

#### API-First Design

| Component | Approach |
|-----------|----------|
| **Core architecture** | RESTful API as primary interface |
| **Internal apps** | All portals consume the same API |
| **External integrations** | Same API available to partners |
| **Future-proofing** | Any system can integrate via standard REST |

#### Integration Categories (Future)

| Category | Examples | Priority |
|----------|----------|----------|
| **Communication** | Gmail, email providers | Month 3 (Sales CRM) |
| **Accounting** | Partner accounting systems | Future |
| **Logistics** | Shipping/transport tracking | Future |
| **ERP** | Partner ERP systems | Future |
| **Trading** | Trading platforms | Future |

**API Design Principles:**
- RESTful endpoints with consistent patterns
- JSON request/response format
- OAuth2/API key authentication
- Rate limiting for external consumers
- Versioned endpoints for backwards compatibility
- Comprehensive API documentation

### AI Communication Layer

#### Automation-First Communication

| Communication Type | AI Handling | Human Escalation |
|--------------------|-------------|------------------|
| Order confirmations | Fully automated | Never |
| Status updates | Fully automated | Never |
| Delivery notifications | Fully automated | Never |
| Standard inquiries | AI-assisted response | If AI uncertain |
| Quote requests (standard) | AI-generated draft | Human review |
| Complaints/issues | AI triage | Always escalate |
| New relationships | AI initial response | Human follow-up |

**Goal:** No human needed for routine, everyday communications. System handles standard interactions automatically, freeing team for high-value activities.

### Compliance Requirements

| Area | Requirement |
|------|-------------|
| **Data protection** | GDPR compliance (EU users) |
| **Data residency** | EU-based hosting preferred |
| **Audit trail** | All actions logged with timestamp and user |
| **Data retention** | Configurable per data type |
| **Export** | Users can export their own data |

*Note: No industry-specific compliance (healthcare, finance) required.*

### Technical Constraints

| Constraint | Rationale |
|------------|-----------|
| **Single database** | All apps share one Supabase instance |
| **Real-time sync** | Users expect instant updates |
| **Mobile-responsive** | Factory floor, warehouse, on-site use |
| **Offline consideration** | Future: offline mode for production reporting |
| **Multi-language** | Future: Swedish, Norwegian, Finnish, etc. |

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP - Build the operational foundation first, then expand user types and automation progressively.

**Strategic Rationale:**
1. **Producer Portal First** - Without production tracking, Timber World can't prove the orchestrator model works
2. **Client Portal Second** - Clients need to see orders and submit requirements, but can't order if production isn't tracked
3. **Supplier Portal Third** - Suppliers are essential but can continue current workflows initially
4. **Sales CRM Fourth** - Sales can use existing tools until core operations are automated
5. **Automation Last** - Requires all user types in system before workflows can automate

**Core Insight:** The platform builds bottom-up from production (where materials transform) to sales (where deals originate).

### MVP Feature Set (Phase 1 - Month 1-2)

#### Core User Journeys Supported

| Journey | MVP Support Level | Why |
|---------|-------------------|-----|
| **Viktor (Producer)** | Full | Core value proposition - production tracking |
| **Erik/Anna (Client)** | Basic | Document submission, order visibility (not full self-service) |
| **Katja (Admin)** | Full | Must manage producers and see inventory |
| **Nils (Executive)** | Basic | Dashboard with inventory totals |
| **Lars (Supplier)** | Deferred | Month 2 |
| **Johan (Purchase)** | Deferred | Month 3 |
| **Max (Sales)** | Deferred | Month 3 |

#### Must-Have Capabilities (MVP)

**Producer Functions:**
- Producer authentication and login
- View inventory at their facility (raw materials from TW)
- Enter production (input materials → output products)
- Submit completed production
- View efficiency metrics
- View production history

**Client Functions (Basic):**
- Client authentication and login
- View order history and status
- Submit documents (invoices, packing lists)
- Submit project orders/requirements
- Communication with Timber World

**Admin Functions:**
- Create and manage producer accounts
- Enter inventory sent to producers
- View inventory at all producer facilities
- View production efficiency reports
- Create and manage client accounts
- View all orders and status

**Technical Foundation:**
- Authentication system (Supabase Auth)
- Role-based access control
- Organization data isolation
- Basic API endpoints
- Real-time data sync (Supabase realtime)

### Post-MVP Features

#### Phase 2: Supplier Portal (Month 2)

**New Capabilities:**
- Supplier authentication and login
- View purchase orders from Timber World
- Confirm/decline orders
- Report delivery (shipped notification)
- Upload documents (invoices, CMRs, packing lists)
- View payment status

**Admin Extensions:**
- Create and manage supplier accounts
- Create purchase orders
- Track incoming deliveries
- Approve supplier invoices

---

#### Phase 3: Sales CRM + Purchase Management (Month 3)

**Sales Capabilities:**
- Sales authentication and login
- CRM pipeline (deals, stages, contacts)
- Create quotes (connected to real inventory)
- Convert quotes to orders
- View client order status
- Activity logging (calls, meetings, follow-ups)

**Purchase Capabilities:**
- Purchase manager functions
- Inventory level dashboards
- Create purchase orders
- Supplier management
- Shortage alerts
- Delivery tracking

**Admin Extensions:**
- Sales performance reporting
- Purchase analytics

---

#### Phase 4: Automation (Month 4)

**Workflow Automation:**
- Quote approval → Order creation (automatic)
- Order → Purchase order (automatic trigger)
- Materials received → Production order (automatic)
- Status change → Notifications (automatic)

**Document Generation:**
- Auto-generate invoices from order data
- Auto-generate CMRs from delivery data
- Auto-generate packing lists

**AI Communication:**
- AI-assisted inquiry responses
- AI-generated quote drafts
- AI triage for complaints/issues

---

#### Phase 5: Full Platform (Month 5-6)

**Enhancements:**
- Email integration (Gmail sync)
- Advanced reporting and analytics
- Performance dashboards
- Mobile optimization refinements
- User experience improvements based on feedback

**Validation:**
- All user types active on portal
- 90% reduction in manual operational tasks achieved
- Small orders economically viable

### Resource Requirements

#### MVP Team (Month 1-2)

| Role | Count | Focus |
|------|-------|-------|
| Full-stack Developer | 1-2 | Core platform build |
| Product Owner | 1 | Requirements, user testing |

**Assumptions:**
- Existing Turborepo monorepo structure in place
- Supabase as backend (already configured)
- React/Next.js frontend (team familiar)

#### Growth Team (Month 3-6)

| Role | Count | Focus |
|------|-------|-------|
| Full-stack Developer | 2 | Continued development |
| Product Owner | 1 | Requirements, prioritization |
| UX/Design | 0.5 | UI improvements, user research |

### Risk Mitigation Strategy

#### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Real-time sync complexity | Medium | High | Use Supabase realtime (proven tech) |
| Data isolation bugs | Medium | Critical | Implement row-level security from day 1; security review |
| Producer adoption friction | Medium | High | Mobile-first design; user testing with Viktor persona |
| Performance at scale | Low | Medium | Optimize after proving concept; Supabase handles scale |

#### Market Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Producers don't adopt | Medium | Critical | Start with 2-3 champion producers; make it obviously better than WhatsApp |
| Network doesn't reach critical mass | Medium | High | Focus on dense clusters (geography/product type) |
| Competitors copy model | Low | Medium | Move fast; network effects compound; execution > idea |

#### Resource Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Developer bandwidth | Medium | High | Prioritize ruthlessly; MVP features only |
| Scope creep | High | Medium | Strict phase boundaries; defer nice-to-haves |
| Timeline slip | Medium | Medium | Month 1 focus on Producer only if needed |

### Scope Boundaries (Explicit)

#### IN Scope for MVP

- Producer Portal (full)
- Client Portal (basic)
- Admin functions (essential)
- Authentication & RBAC
- Data isolation
- Basic API

#### OUT of Scope for MVP (Deferred)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| Supplier Portal | Month 2 | Suppliers can continue current workflow |
| Sales CRM | Month 3 | Sales can use existing tools |
| Purchase Portal | Month 3 | Purchase manager can use admin functions |
| Automation workflows | Month 4 | Requires all user types first |
| AI communication | Month 4+ | Enhancement, not foundation |
| Email integration | Month 5+ | Enhancement |
| Multi-language | Post Month 6 | English-first |
| Native mobile apps | Post Month 6 | Web works on mobile |
| E-signatures | Future | Manual OK initially |
| Bank integration | Future | Manual export initially |

### Success Gates

| Phase | Success Gate | Proceed If |
|-------|--------------|------------|
| **Month 1** | Producer tracking live | 2-3 producers using portal daily |
| **Month 2** | Supplier onboarding | First supplier confirms order through portal |
| **Month 3** | Sales adoption | Sales creating quotes in system |
| **Month 4** | Automation working | At least one workflow fully automated |
| **Month 6** | Full platform | All user types active, measurable ops reduction |

---

## Functional Requirements

### Role Hierarchy

| Role | Scope | Primary Responsibilities |
|------|-------|-------------------------|
| **Super Admin** | Full system control | Sets Admin permissions, ultimate authority |
| **Admin** | IT/System administration | Platform setup, role configuration, function permissions |
| **Sales** | Client domain | Client management, CRM, quotes, client orders |
| **Purchase** | Supplier/Producer domain | Supplier management, producer management, procurement |
| **Producer** | Production operations | Production reporting at their facility |
| **Supplier** | Supply operations | Order fulfillment to Timber World |
| **Client** | Purchasing | Orders and communication with Timber World |

### Function Permission Model

Every function in the system can be:
- Enabled/disabled at the **role level** (default for all users with that role)
- Overridden at the **user level** (specific user gets different access than their role default)
- User-level settings always override role-level settings

---

### 1. User Management & Authentication

- FR1: Users can register for an account with organization association
- FR2: Users can authenticate using email and password
- FR3: Users can reset their password via email
- FR4: Users can view and update their profile information
- FR5: Super Admin can configure which functions are available to Admin role
- FR6: Super Admin can create and manage Admin users
- FR7: Admin can create user accounts for any organization type (when function enabled)
- FR8: Admin can assign roles to users (client, supplier, producer, sales, purchase)
- FR9: Admin can assign multiple roles to a single user
- FR10: Admin can toggle individual functions on/off for each role
- FR11: Admin can toggle individual functions on/off for each specific user
- FR12: Admin can deactivate user accounts
- FR13: Admin can delegate admin functions to other roles
- FR14: Sales can create and manage users within client organizations (when function enabled)
- FR15: Purchase can create and manage users within supplier organizations (when function enabled)
- FR16: Purchase can create and manage users within producer organizations (when function enabled)
- FR17: System enforces organization-based data isolation
- FR18: System enforces function-level access control (checks role AND user permissions)
- FR19: System logs all permission changes for audit

### 2. Organization Management

- FR20: Admin can create and manage all organization types
- FR21: Sales can create client organizations (when function enabled)
- FR22: Sales can view and edit client organization details (when function enabled)
- FR23: Purchase can create supplier organizations (when function enabled)
- FR24: Purchase can view and edit supplier organization details (when function enabled)
- FR25: Purchase can create producer organizations (when function enabled)
- FR26: Purchase can view and edit producer organization details (when function enabled)
- FR27: Admin can transfer organization management between users
- FR28: System maintains complete data separation between organizations
- FR29: Each organization management function can be independently toggled per role/user

### 3. Inventory Management

- FR30: Admin can record inventory sent to producer facilities
- FR31: Purchase can record inventory sent to producer facilities (when function enabled)
- FR32: Producers can view current inventory at their facility
- FR33: Admin can view inventory levels across all producer facilities
- FR34: Purchase can view inventory levels across all producer facilities (when function enabled)
- FR35: System tracks inventory by location, product type, and quantity
- FR36: System calculates inventory changes based on production reports
- FR37: Sales can view available inventory when creating quotes (when function enabled)
- FR38: System generates alerts when inventory falls below defined thresholds
- FR39: Admin can configure inventory alert thresholds

### 4. Production Management

- FR40: Producers can view production orders assigned to them
- FR41: Producers can accept or decline production orders (when function enabled)
- FR42: Producers can report production (input materials → output products)
- FR43: Producers can record waste/loss during production
- FR44: Producers can submit completed production
- FR45: Producers can view their production history
- FR46: Producers can view their efficiency metrics
- FR47: Admin can create production orders for producers
- FR48: Purchase can create production orders for producers (when function enabled)
- FR49: Admin can view production status across all producers
- FR50: Purchase can view production status across all producers (when function enabled)
- FR51: Admin can view and compare producer efficiency reports
- FR52: System calculates production efficiency (output/input ratio)

### 5. Order Management

- FR53: Clients can view their order history
- FR54: Clients can view current order status
- FR55: Clients can submit new project orders with specifications (when function enabled)
- FR56: Clients can reorder from previous orders (when function enabled)
- FR57: Clients can track delivery status of their orders
- FR58: Sales can create orders on behalf of clients (when function enabled)
- FR59: Sales can view all client orders they manage (when function enabled)
- FR60: Admin can create and manage any client order
- FR61: Admin can update order status
- FR62: Admin can assign orders to production
- FR63: Purchase can assign orders to production (when function enabled)
- FR64: System tracks order lifecycle (created → quoted → confirmed → in production → shipped → delivered)

### 6. Sales & CRM

- FR65: Sales can view and manage their sales pipeline
- FR66: Sales can create and manage deals with stages
- FR67: Sales can create and manage contacts (companies and people)
- FR68: Sales can create quotes for clients
- FR69: Sales can generate quote documents (PDF)
- FR70: Sales can convert approved quotes to orders (when function enabled)
- FR71: Sales can view client order history and status
- FR72: Sales can log activities (calls, meetings, follow-ups)
- FR73: Sales can set reminders for follow-up actions
- FR74: System connects quotes to real-time inventory and pricing
- FR75: Admin can view sales performance across all agents
- FR76: Admin can configure sales pipeline stages
- FR77: Admin can assign clients to specific sales agents

### 7. Procurement & Purchasing

- FR78: Purchase can view all suppliers
- FR79: Purchase can create purchase orders for suppliers
- FR80: Purchase can track purchase order status
- FR81: Purchase can view incoming delivery schedule
- FR82: Purchase can manage supplier relationships and contacts
- FR83: Purchase can view supplier performance metrics
- FR84: Admin can approve purchase orders above defined thresholds (when function enabled)
- FR85: Purchase can approve purchase orders (when function enabled, with configurable limits)
- FR86: System generates alerts for pending procurement actions
- FR87: Admin can configure purchase approval thresholds

### 8. Supplier Portal

- FR88: Suppliers can view purchase orders from Timber World
- FR89: Suppliers can confirm or decline purchase orders (when function enabled)
- FR90: Suppliers can report shipment/delivery of orders
- FR91: Suppliers can upload delivery documents (CMR, packing list)
- FR92: Suppliers can submit invoices for completed orders (when function enabled)
- FR93: Suppliers can view payment status of their invoices
- FR94: Suppliers can view their order history with Timber World
- FR95: Purchase can view supplier portal activity for their suppliers

### 9. Document Management

- FR96: Clients can upload documents (invoices, packing lists, specifications)
- FR97: Suppliers can upload documents (invoices, CMRs, delivery notes)
- FR98: Producers can upload documents (quality reports, photos)
- FR99: System stores documents associated with orders
- FR100: Users can download documents they have access to
- FR101: System generates quotes as PDF documents
- FR102: System generates purchase orders as PDF documents
- FR103: System generates invoices from order data (when automation enabled)
- FR104: Admin can configure document templates

### 10. Communication & Notifications

- FR105: Users can send messages to Timber World through the portal
- FR106: Sales can send messages to their clients through the portal
- FR107: Purchase can send messages to their suppliers/producers through the portal
- FR108: Admin can send messages to any user through the portal
- FR109: System sends notifications for order status changes
- FR110: System sends notifications for production completion
- FR111: System sends notifications for delivery confirmations
- FR112: System sends notifications for payment status updates
- FR113: System sends reminder notifications for pending actions
- FR114: Users can configure notification preferences (when function enabled)
- FR115: Admin can configure system-wide notification rules

### 11. Reporting & Analytics

- FR116: Super Admin can view all system reports
- FR117: Admin can view operational dashboard
- FR118: Admin can view KPI dashboard with key metrics
- FR119: Admin can view total inventory value across locations
- FR120: Admin can view order volume and trends
- FR121: Admin can filter and search across orders, inventory, and production
- FR122: Admin can export reports in standard formats
- FR123: Sales can view their pipeline analytics
- FR124: Sales can view their client performance reports (when function enabled)
- FR125: Purchase can view procurement analytics
- FR126: Purchase can view supplier performance reports
- FR127: System tracks all user actions for audit trail
- FR128: Admin can view audit logs

### 12. System Administration

- FR129: Super Admin can access all system configuration
- FR130: Super Admin can enable/disable functions for Admin role
- FR131: Admin can configure role default permissions
- FR132: Admin can configure user-specific permission overrides
- FR133: Admin can view permission matrix (all roles × all functions)
- FR134: Admin can create custom permission templates
- FR135: Admin can manage system settings
- FR136: Admin can configure workflow automation rules (when automation phase)
- FR137: Admin can view system health and status
- FR138: Admin can manage API keys and external access

### 13. Automation (Phase 4+)

- FR139: System can automatically create orders from approved quotes (when enabled)
- FR140: System can automatically trigger purchase orders based on inventory levels (when enabled)
- FR141: System can automatically create production orders when materials are received (when enabled)
- FR142: System can automatically send status update notifications
- FR143: System can auto-generate documents from order data
- FR144: AI can draft responses to standard inquiries (when enabled)
- FR145: AI can generate initial quote drafts based on request patterns (when enabled)
- FR146: AI can triage incoming communications for routing (when enabled)
- FR147: Admin can configure automation rules and triggers
- FR148: Admin can enable/disable specific automations per workflow

### 14. API & Integration

- FR149: System exposes RESTful API for all core capabilities
- FR150: External systems can authenticate via API keys or OAuth
- FR151: External systems can read data they are authorized to access
- FR152: External systems can write data they are authorized to modify
- FR153: API permissions follow same function-level access control as UI
- FR154: API supports versioning for backwards compatibility
- FR155: System logs all API access for security and debugging
- FR156: Admin can create and manage API keys
- FR157: Admin can configure API rate limits
- FR158: Admin can view API usage analytics

---

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| **NFR1: Page Load Time** | < 3 seconds on 4G connection | Mobile factory floor users need fast access |
| **NFR2: API Response Time** | < 500ms for standard operations | Real-time inventory updates are core value |
| **NFR3: Real-time Updates** | < 2 seconds propagation | Inventory changes must reflect immediately across users |
| **NFR4: Search Response** | < 1 second for filtered queries | Admins search across large datasets |
| **NFR5: Document Generation** | < 5 seconds for PDF quotes/POs | Sales creating quotes in customer conversations |
| **NFR6: Concurrent Users** | Support 100+ simultaneous users | Multiple producers, clients, sales active at once |
| **NFR7: Mobile Performance** | Usable on mid-range smartphones | Producer/warehouse staff use varied devices |

### Security

| Requirement | Specification | Rationale |
|-------------|---------------|-----------|
| **NFR8: Data Isolation** | Row-level security enforced at database level | Organizations must never see each other's data |
| **NFR9: Encryption at Rest** | AES-256 for stored data | Protect business-sensitive information |
| **NFR10: Encryption in Transit** | TLS 1.3 for all communications | Secure data transfer |
| **NFR11: Authentication** | Multi-factor authentication available for all users | Account security |
| **NFR12: Session Management** | Sessions expire after 24 hours inactive | Balance convenience and security |
| **NFR13: Password Policy** | Minimum 8 characters, complexity requirements | Prevent weak passwords |
| **NFR14: API Security** | Rate limiting, API key rotation, OAuth support | Protect against abuse |
| **NFR15: Audit Logging** | All data access and changes logged with user/timestamp | Compliance and debugging |
| **NFR16: GDPR Compliance** | Data export, deletion on request, consent tracking | EU user requirements |
| **NFR17: Permission Enforcement** | Function-level checks on every request | Prevent unauthorized access |

### Scalability

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| **NFR18: Organization Growth** | Support 500+ organizations (combined clients/suppliers/producers) | Network effects strategy |
| **NFR19: User Growth** | Support 2,000+ total users | Multiple users per organization |
| **NFR20: Data Volume** | Handle 100,000+ orders/year | Business growth projection |
| **NFR21: Document Storage** | Scale to 1TB+ documents | Historical orders, invoices, CMRs |
| **NFR22: Horizontal Scaling** | Architecture supports adding capacity without redesign | Future growth |
| **NFR23: Database Performance** | Maintain response times as data grows 10x | Long-term viability |

### Reliability

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| **NFR24: Availability** | 99.5% uptime (excludes planned maintenance) | Business operations depend on system |
| **NFR25: Planned Maintenance** | Outside business hours (EU timezone), < 4 hours/month | Minimize disruption |
| **NFR26: Data Backup** | Daily automated backups, 30-day retention | Data protection |
| **NFR27: Recovery Time** | < 4 hours from complete failure | Business continuity |
| **NFR28: Data Durability** | No data loss on infrastructure failure | Critical business data |
| **NFR29: Graceful Degradation** | Core functions remain available if secondary services fail | Resilience |

### Accessibility

| Requirement | Specification | Rationale |
|-------------|---------------|-----------|
| **NFR30: Mobile Responsive** | Full functionality on tablets and smartphones | Factory floor, warehouse, field use |
| **NFR31: Touch Targets** | Minimum 44x44px touch targets | Usable with gloves, outdoor conditions |
| **NFR32: Color Contrast** | WCAG AA contrast ratios | Readability in varied lighting |
| **NFR33: Keyboard Navigation** | Core functions accessible via keyboard | Power users, accessibility |
| **NFR34: Screen Reader Compatible** | Key interfaces work with screen readers | Basic accessibility |
| **NFR35: Font Scaling** | UI remains usable at 150% zoom | Visual impairment support |

### Integration

| Requirement | Specification | Rationale |
|-------------|---------------|-----------|
| **NFR36: API Availability** | RESTful API covers all core functionality | External integration foundation |
| **NFR37: API Documentation** | OpenAPI/Swagger specification maintained | Developer experience |
| **NFR38: API Versioning** | Backward-compatible changes, version deprecation with 6-month notice | Partner stability |
| **NFR39: Webhook Support** | Event notifications for key state changes | Real-time integrations |
| **NFR40: Standard Formats** | JSON for data, PDF for documents | Interoperability |
| **NFR41: Email Integration** | SMTP/IMAP support for communication sync | Future Gmail integration |

### Usability

| Requirement | Specification | Rationale |
|-------------|---------------|-----------|
| **NFR42: Learning Curve** | Core tasks learnable within 30 minutes without training | Adoption by non-technical users |
| **NFR43: Error Messages** | Clear, actionable error messages in user language | Reduce support burden |
| **NFR44: Undo/Recovery** | Critical actions have confirmation or undo | Prevent costly mistakes |
| **NFR45: Offline Indicators** | Clear feedback when connectivity is lost | Factory floor connectivity varies |
| **NFR46: Progress Feedback** | Loading states for operations > 1 second | User confidence |

### Maintainability

| Requirement | Specification | Rationale |
|-------------|---------------|-----------|
| **NFR47: Deployment** | Zero-downtime deployments possible | Continuous improvement |
| **NFR48: Monitoring** | Health metrics, error tracking, performance monitoring | Proactive issue detection |
| **NFR49: Logging** | Structured logs for all services | Debugging and audit |
| **NFR50: Configuration** | Environment-based configuration, no code changes for settings | Operational flexibility |

---
