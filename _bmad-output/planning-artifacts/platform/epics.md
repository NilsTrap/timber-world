---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - 'planning-artifacts/platform/prd.md'
  - 'planning-artifacts/platform/architecture.md'
  - 'planning-artifacts/platform/ux-design-specification.md'
  - 'planning-artifacts/platform/inventory-data-model-v2.md'
  - 'analysis/brainstorming-platform-multitenancy-2026-01-25.md'
  - 'analysis/multi-tenant-architecture-design-2026-02-01.md'
scope: 'Producer MVP + Multi-Tenancy Extension + Platform Foundation v2'
targetUsers: ['Super Admin', 'Organization User', 'Admin (legacy)', 'Producer (Factory Manager)']
epicCount: 10
storyCount: 54  # 19 original + 19 (Epics 6-9) + 16 (Epic 10)
workflowComplete: true
completedDate: '2026-01-25'
status: 'ready-for-implementation'
lastUpdated: '2026-02-06'
updateNote: 'Updated Epic 8 with pallet grouping, on-the-way status, and draft blocking features'
---

# Timber-World Producer MVP - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Timber-World **Producer MVP**, decomposing the MVP-scoped requirements from the PRD, UX Design, and Architecture into implementable stories.

**Scope:** Producer Portal MVP - Production Tracking with Admin Inventory Management
**Target Users:** Admin (Timber World) + Producer (Factory Manager)

## Requirements Inventory

### Functional Requirements (MVP-Scoped)

From PRD, filtered to Producer MVP scope (updated to include Admin inventory functions):

```
FR2: Users can authenticate using email and password
FR4: Users can view and update their profile information
FR30: Admin can record inventory sent to producer facilities
FR32: Producers can view current inventory at their facility
FR33: Admin can view inventory levels across all producer facilities
FR42: Producers can report production (input materials → output products)
FR43: Producers can record waste/loss during production
FR44: Producers can submit completed production
FR45: Producers can view their production history
FR46: Producers can view their efficiency metrics
FR51: Admin can view and compare producer efficiency reports
FR52: System calculates production efficiency (output/input ratio)
```

**Total: 12 Functional Requirements**

### Non-Functional Requirements (MVP-Scoped)

From PRD, filtered to what applies to single-user MVP:

```
NFR1: Page load time < 3 seconds on 4G connection
NFR2: API response time < 500ms for standard operations
NFR7: Usable on mid-range desktop browsers
NFR30: Responsive for desktop (1024px minimum width)
NFR32: WCAG AA color contrast ratios
NFR33: Core functions accessible via keyboard
NFR42: Core tasks learnable within 30 minutes without training
NFR43: Clear, actionable error messages
NFR44: Critical actions have confirmation or undo
NFR46: Loading states for operations > 1 second
```

**Total: 10 Non-Functional Requirements**

### Additional Requirements

#### From Architecture (MVP Addendum)

**Database Setup (Inventory Data Model v2):**
- Create 14 tables: portal_users, 7 reference tables (ref_product_names, ref_wood_species, ref_humidity, ref_types, ref_processing, ref_fsc, ref_quality), parties, shipments, inventory_packages, portal_processes, portal_production_entries, portal_production_lines
- Seed reference data, standard processes, and initial parties (TWP, INE)
- No RLS needed (single tenant)
- No organization_id columns (single producer)

**Portal App Setup:**
- Create `apps/portal/` within existing Turborepo monorepo
- Follow Next.js App Router patterns from marketing website
- Use @timber/* shared packages
- Simple auth middleware (login check only, no RBAC)

**Simplified Auth (Updated):**
- Supabase Auth with email/password
- Two simple roles: `admin` and `producer`
- Role-based navigation (Admin sees inventory management, Producer sees production)
- Simple role check (not full RBAC)

#### From UX Design Specification

**Core Screens (4 total):**
1. Dashboard - Total inventory, per-process metrics (Outcome %, Waste %)
2. Inventory - Table of all products with totals per product type
3. Production - Create/edit production entry with input/output line items
4. Production History - List of completed processes, click to view/edit

**Key Interactions:**
- Smart output generation (auto-generate from inputs)
- "Apply to All" for common dimension values
- Live running totals during production entry
- Validation confirmation before committing
- Edit existing production entries from history

**Process Configuration:**
- Standard processes: Multi-saw, Planing, Opti-cut, Gluing, Sanding, Finger Jointing
- Custom processes can be added by Factory Manager

**Component Strategy:**
- Use shadcn/ui components (Table, Card, Button, Input, Select, Dialog, Form)
- Custom components: ProductLineItem, ProductionSummary, ProcessSelector, MetricCard

**Accessibility:**
- Keyboard shortcuts: Ctrl+I (add input), Ctrl+O (add output), Ctrl+Enter (validate), Escape (cancel)
- Keyboard shortcuts MUST be visually displayed on the production entry page (e.g., small hint labels next to the relevant buttons or in a visible shortcuts bar)
- Tab navigation through all flows
- Visible focus indicators

**Form Patterns:**
- "+ Add Item" button for line items
- Validate on blur
- Required fields marked with *
- Running totals update instantly

### FR Coverage Map

| FR | Epic | User | Description |
|----|------|------|-------------|
| FR2 | Epic 1 | Both | Email/password authentication |
| FR4 | Epic 1 | Both | View/update profile |
| FR30 | Epic 2 | Admin | Record inventory sent to producers |
| FR33 | Epic 2 | Admin | View inventory across all facilities |
| FR32 | Epic 3 | Producer | View inventory at their facility |
| FR42 | Epic 4 | Producer | Report production (input → output) |
| FR43 | Epic 4 | Producer | Record waste/loss |
| FR44 | Epic 4 | Producer | Submit completed production |
| FR45 | Epic 5 | Producer | View production history |
| FR46 | Epic 5 | Producer | View efficiency metrics |
| FR51 | Epic 5 | Admin | View producer efficiency reports |
| FR52 | Epic 5 | Both | System calculates efficiency |

**Coverage:** 12/12 FRs mapped (100%)

## Epic List

### Epic 1: Portal Foundation & User Access
**User Outcome:** Users (Admin and Producer) can log into the portal with role-based navigation

**FRs covered:** FR2, FR4

**Additional Requirements:**
- Portal app setup in monorepo (`apps/portal/`)
- Database schema (6 tables + roles)
- Seed data for standard processes
- Two simple roles (admin, producer)
- Role-based dashboard shell and navigation

**Standalone Value:** Both user types can log in and see appropriate navigation for their role.

---

### Epic 2: Admin Inventory Management
**User Outcome:** Admin can manage reference data, organisations, create shipments with packages, and view all inventory levels

**FRs covered:** FR30, FR33

**Data Model:** Uses Inventory Data Model v2 (flat shipment/package model)

**Additional Requirements:**
- Reference data management (7 dropdown tables)
- Organisations management (parties with 3-character codes)
- Shipment creation with auto-generated codes
- Package entry with all attributes (7 dropdowns, dimensions, volume calculation)
- Admin inventory overview with filtering

**Standalone Value:** Admin can record what materials were sent to the producer via shipments and packages. Complete inventory input system.

---

### Epic 3: Producer Inventory View
**User Outcome:** Producer can view current inventory at their facility with quantities and totals

**FRs covered:** FR32

**Additional Requirements:**
- Producer inventory table (read-only view of what Admin inputted)
- Filtering and sorting
- Totals per product type
- Product details view

**Standalone Value:** Producer sees what materials they have available. Builds on Epic 2.

---

### Epic 4: Production Entry & Tracking
**User Outcome:** Producer can log production transformations (input → process → output) and commit to inventory

**FRs covered:** FR42, FR43, FR44

**Additional Requirements:**
- Production form with process selection (standard + custom)
- Input line items (select from inventory)
- Output line items (with auto-generation from inputs)
- Live m³ calculations
- Waste calculation (input - output)
- Validation workflow with confirmation dialog
- Inventory update on commit

**Standalone Value:** Core production tracking complete. Producer can create production entries that update inventory.

---

### Epic 5: Production Insights & History
**User Outcome:** Producer can view production history (as a tab within the Production page), create correction entries to fix mistakes; Admin can view producer efficiency reports

**FRs covered:** FR45, FR46, FR51, FR52

**Additional Requirements:**
- Production page has two tabs: Active (drafts) + History (validated entries)
- Validated entries are permanent — no editing or deleting
- Corrections are new production entries (same flow) flagged as "correction" and linked to the original
- Dashboard metrics (outcome %, waste %)
- Per-process efficiency breakdown
- Admin efficiency overview/comparison

**Standalone Value:** Complete analytics for both user types. Full visibility into production performance.

---

## Epic 1: Portal Foundation & User Access

**Goal:** Users (Admin and Producer) can log into the portal with role-based navigation

**FRs covered:** FR2, FR4

---

### Story 1.1: Portal App & Database Foundation

**As a** developer,
**I want** the portal app and database schema set up,
**So that** all subsequent features have a foundation to build on.

**Acceptance Criteria:**

**Given** the existing Turborepo monorepo
**When** I run the portal app setup
**Then** `apps/portal/` is created with Next.js App Router structure
**And** the app integrates with `@timber/ui`, `@timber/database`, `@timber/config` packages
**And** the app runs successfully on `localhost:3001`

**Given** the Supabase database
**When** migrations are applied
**Then** the following tables exist: `users`, `products`, `inventory`, `processes`, `production_entries`, `production_lines`
**And** a `role` column exists on `users` table (enum: 'admin', 'producer')
**And** standard processes are seeded: Multi-saw, Planing, Opti-cut, Gluing, Sanding, Finger Jointing

---

### Story 1.2: User Registration

**As a** new user,
**I want** to register for an account,
**So that** I can access the portal.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter valid email, password, name, and select a role (admin/producer)
**Then** my account is created in Supabase Auth
**And** a corresponding record is created in the `users` table with my role
**And** I am redirected to the login page with a success message

**Given** I enter an email that already exists
**When** I submit the registration form
**Then** I see an error message "Email already registered"
**And** the form is not submitted

**Given** I enter a password less than 8 characters
**When** I submit the form
**Then** I see a validation error "Password must be at least 8 characters"

---

### Story 1.3: User Login & Session

**As a** registered user,
**I want** to log in to the portal,
**So that** I can access my role-specific features.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I enter valid email and password
**Then** I am authenticated via Supabase Auth
**And** I am redirected to my role-appropriate dashboard
**And** my session persists across page refreshes

**Given** I enter incorrect credentials
**When** I submit the login form
**Then** I see an error message "Invalid email or password"
**And** I remain on the login page

**Given** I am logged in
**When** I click "Logout"
**Then** my session is terminated
**And** I am redirected to the login page

**Given** I try to access a protected route without being logged in
**When** the page loads
**Then** I am redirected to the login page

---

### Story 1.4: Role-Based Navigation

**As a** logged-in user,
**I want** to see navigation appropriate to my role,
**So that** I can access the features relevant to me.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I view the dashboard
**Then** I see navigation links: Dashboard, Inventory, Reference Data, Organisations
**And** the dashboard shows an "Admin Overview" header

**Given** I am logged in as Producer
**When** I view the dashboard
**Then** I see navigation links: Dashboard, Inventory (view), Production
**And** the dashboard shows a "Production Dashboard" header

**Given** I am a Producer
**When** I try to access an Admin-only route (e.g., /inventory/manage)
**Then** I am redirected to my dashboard with an "Access denied" message

---

### Story 1.5: User Profile Management

**As a** logged-in user,
**I want** to view and update my profile,
**So that** my information stays current.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to my profile page
**Then** I see my current name, email, and role displayed
**And** my role is displayed but not editable

**Given** I am on my profile page
**When** I update my name and click Save
**Then** my name is updated in the database
**And** I see a success toast "Profile updated"

**Given** I am on my profile page
**When** I try to save with an empty name field
**Then** I see a validation error "Name is required"
**And** the form is not submitted

---

## Epic 2: Admin Inventory Management

**Goal:** Admin can manage reference data, organisations, and record inventory shipments to producer facilities

**FRs covered:** FR30, FR33

**Data Model:** Uses Inventory Data Model v2 (flat shipment/package model)

---

### Story 2.1: Reference Data Management

**As an** Admin,
**I want** to manage all dropdown options (product names, species, humidity, etc.),
**So that** users can select from consistent, controlled lists when entering inventory.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to Admin > Reference Data
**Then** I see a menu of reference tables: Product Names, Wood Species, Humidity, Types, Processing, FSC, Quality

**Given** I select a reference table (e.g., Wood Species)
**When** the page loads
**Then** I see a table with columns: Value, Sort Order, Status (Active/Inactive), Actions
**And** I see an "Add" button

**Given** I am viewing a reference table
**When** I click "Add"
**Then** I see a form to add a new option with fields: Value (required)
**And** I can save the new option

**Given** I am viewing a reference table
**When** I click Edit on a row
**Then** I can modify the value
**And** changes are saved to the database
**And** existing inventory using this value automatically reflects the change

**Given** I want to remove an option
**When** I click Deactivate on a row
**Then** the option is marked inactive (is_active = false)
**And** the option no longer appears in dropdown selectors
**And** existing inventory using this option retains the value

**Given** I try to add a value that already exists
**When** I click Save
**Then** I see an error "This value already exists"

**Given** I want to reorder options
**When** I drag and drop rows
**Then** the sort_order is updated
**And** dropdowns show options in the new order

---

### Story 2.2: Organisations Management

**As an** Admin,
**I want** to manage organisations (such as Timber World, producers),
**So that** I can create shipments between them.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to Admin > Organisations
**Then** I see a table of all organisations with columns: Code, Name, Status, Actions

**Given** I am viewing the organisations table
**When** I click "Add Organisation"
**Then** I see a form with fields: Code (first character letter, followed by 2 letters or numbers, required), Name (required)

**Given** I am adding a new organisation
**When** I enter a valid 3-character code and name
**Then** the organisation is created
**And** I see a success toast "Organisation created"
**And** the organisation appears in the table

**Given** I try to add an organisation with an existing code
**When** I click Save
**Then** I see an error "Organisation code already exists"

**Given** I am editing an organisation
**When** I modify the name and save
**Then** the name is updated
**And** the code remains unchanged (immutable)

**Given** I try to deactivate an organisation with existing shipments
**When** I click Deactivate
**Then** I see a warning "This organisation has X shipments and cannot be deleted"
**And** I can only deactivate (not delete)

---

### Story 2.3: Create Shipment & Add Packages

**As an** Admin,
**I want** to create a shipment and add packages with all attributes,
**So that** I can record inventory sent to the producer facility.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to Inventory > New Shipment
**Then** I see a shipment form with: From Organisation (dropdown), To Organisation (dropdown), Date (default today)

**Given** I am creating a shipment
**When** I select From Organisation and To Organisation
**Then** the shipment code is auto-generated and displayed (e.g., "TWP-INE-001")
**And** I cannot edit the shipment code

**Given** I have created a shipment header
**When** I proceed to add packages
**Then** I see the standard `DataEntryTable` component (see Architecture: Standard Package/Inventory Table Pattern) with all 14 columns in the standard order: Shipment, Package, Product, Species, Humidity, Type, Processing, FSC, Quality, Thickness, Width, Length, Pieces, Vol m³
**And** dropdown columns are collapsible, keyboard navigation works (Tab/Arrow/Enter), and rows support copy/delete

**Given** I am entering a package row
**When** I enter valid dimensions (e.g., "40", "100", "2000") and pieces (e.g., "500")
**Then** Volume m³ is auto-calculated
**And** I see the calculated value in the Volume field

**Given** I enter dimension ranges (e.g., "40-50")
**When** the system detects a range
**Then** Volume m³ is not auto-calculated
**And** I can enter volume manually

**Given** I have entered a package row
**When** I click "Add Row"
**Then** a new empty row is added with auto-generated package number (e.g., "TWP-001-002")

**Given** I have entered a package row
**When** I click "Copy Row"
**Then** a new row is added with the same values as the previous row
**And** the package number is auto-generated
**And** Pieces and Volume fields are cleared (for manual entry)

**Given** I have multiple package rows
**When** I click "Save Shipment"
**Then** the shipment is created in the database
**And** all packages are created in the inventory table
**And** I see a success toast "Shipment created with X packages"
**And** I am redirected to the shipment detail page

**Given** I enter pieces as "-" (not countable)
**When** I try to save
**Then** the system accepts "-" as valid
**And** volume must be entered manually

---

### Story 2.4: Shipment & Inventory Overview

**As an** Admin,
**I want** to view all shipments and inventory packages,
**So that** I can monitor what materials are at producer facilities.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to Inventory > Overview
**Then** I see two tabs: "Inventory" and "Shipments"

**Given** I am on the Shipments tab
**When** I view the table
**Then** I see columns: Shipment Code, From, To, Date, Package Count, Total m³
**And** shipments are sorted by date (newest first)

**Given** I click on a shipment row
**When** the detail view opens
**Then** I see all packages in that shipment with full attributes
**And** I can edit or add more packages

**Given** I am on the Inventory tab
**When** I view the table
**Then** I see all packages in the standard read-only table format (see Architecture: Standard Package/Inventory Table Pattern) with all 14 columns: Shipment, Package, Product, Species, Humidity, Type, Processing, FSC, Quality, Thickness, Width, Length, Pieces, Vol m³
**And** I see summary cards: Total Packages, Total m³
**And** columns are sortable and the table has horizontal scroll on narrow screens

**Given** I am viewing the inventory table
**When** I use the filter bar
**Then** I can filter by: Product Name, Species, Shipment Code
**And** the table updates to show matching packages

**Given** I click column headers
**When** I click
**Then** the table sorts by that column (toggle ascending/descending)

**Given** no shipments exist
**When** I view the overview
**Then** I see an empty state "No shipments recorded yet"
**And** I see a button "Create First Shipment"

---

## Epic 3: Producer Inventory View

**Goal:** Producer can view current inventory (packages) at their facility with all attributes and totals

**FRs covered:** FR32

**Data Model:** Uses Inventory Data Model v2 (flat shipment/package model)

---

### Story 3.1: Producer Inventory Table

**As a** Producer,
**I want** to view all packages at my facility,
**So that** I know what materials are available for production.

**Acceptance Criteria:**

**Given** I am logged in as Producer
**When** I navigate to Inventory
**Then** I see a table of all packages at my facility (where to_organisation = my facility)
**And** the table uses the standard read-only table format (see Architecture: Standard Package/Inventory Table Pattern) with all 14 columns: Shipment, Package, Product, Species, Humidity, Type, Processing, FSC, Quality, Thickness, Width, Length, Pieces, Vol m³

**Given** packages exist for my facility
**When** I view the inventory table
**Then** I see summary cards: Total Packages, Total Pieces, Total m³

**Given** I am viewing the inventory table
**When** I click on a package row
**Then** I see a detail panel/modal showing full package information:
- All attributes (Product, Species, Humidity, Type, Processing, FSC, Quality)
- Full dimensions (Thickness, Width, Length)
- Quantities (Pieces, m³)
- Shipment info (Code, Date, From organisation)
**And** the view is read-only (Producer cannot edit inventory directly)

**Given** no packages exist for my facility
**When** I view the Inventory page
**Then** I see an empty state message "No inventory available"
**And** I see a note "Contact Admin to record incoming shipments"

---

---

## Epic 4: Production Entry & Tracking

**Goal:** Producer can log production transformations (input packages → process → output packages) and commit to inventory

**FRs covered:** FR42, FR43, FR44

**Data Model:** Uses Inventory Data Model v2 - inputs/outputs are packages with all attributes

---

### Story 4.1: Create Production Entry with Process Selection

**As a** Producer,
**I want** to start a new production entry and select a process,
**So that** I can begin logging a production transformation.

**Acceptance Criteria:**

**Given** I am logged in as Producer
**When** I navigate to Production and click "New Production"
**Then** I see a production form with a process dropdown

**Given** I am creating a new production entry
**When** I view the process dropdown
**Then** I see all active processes managed by Admin (via Reference Data)
**And** processes are ordered by sort_order

**Given** I am logged in as Admin
**When** I navigate to Admin > Reference Data
**Then** I see a "Processes" tab alongside existing categories
**And** I can add, edit, reorder, and deactivate processes (same CRUD as other reference data)

**Given** I select a process from the dropdown
**When** I click "Start Production"
**Then** a new `production_entries` record is created with status "draft"
**And** the production date defaults to today
**And** I am redirected to the production entry page

**Given** I have a draft production entry
**When** I navigate to Production
**Then** I can see and continue my draft entry
**And** I can start a new entry if preferred

---

### Story 4.2: Add Production Inputs from Inventory

**As a** Producer,
**I want** to select packages from inventory as production inputs,
**So that** I can record what materials were consumed in the process.

**Acceptance Criteria:**

**Given** I am on a production entry form
**When** I click "+ Add Input"
**Then** I see a large package selector dialog (near full-screen), scrollable both vertically and horizontally
**And** packages are displayed in the full standard 14-column table format (same as Producer Inventory view)
**And** I can use the same sort/filter/collapse features to find packages

**Given** the package selector is open
**When** I check one or more package rows (via checkboxes)
**Then** editable Pieces and Volume fields appear for each selected row
**And** I can enter amounts for multiple packages before confirming
**And** pieces cannot exceed available, volume cannot exceed package total

**Given** I have selected packages with amounts
**When** I click "Add Selected"
**Then** all selected packages are added as inputs with their entered amounts
**And** the selector closes and the inputs table refreshes
**And** collapsed column preferences are persisted and restored across sessions

**Given** I have added input lines
**When** I view the inputs section
**Then** I see all input lines in the standard 14-column table format with full sort/filter/collapse functionality
**And** I see a running total of input m³
**And** I can remove any input line by clicking delete

**Given** I try to enter pieces greater than available in package
**When** I blur the pieces field
**Then** I see a validation error "Pieces exceeds available inventory"

**Given** I try to enter volume m³ greater than available in a package
**When** I blur the volume field
**Then** I see a validation error "Volume exceeds available inventory"

**Given** I have multiple inputs to add
**When** I use keyboard shortcut Ctrl+I
**Then** the package selector opens
**And** the shortcut hint "Ctrl+I" is visibly displayed next to or on the "+ Add Input" button

---

### Story 4.3: Add Production Outputs

**As a** Producer,
**I want** to record the output packages from production,
**So that** I can track what was created from the inputs.

**Acceptance Criteria:**

**Given** I have added inputs to a production entry
**When** I move to the Outputs section
**Then** I see the standard `DataEntryTable` component with all 14 columns, sort/filter/collapse features
**And** output lines can be auto-generated based on inputs (inherit attributes)

**Given** I click "Auto-Generate from Inputs"
**When** the system processes
**Then** output lines are created with inherited attributes:
- Product Name, Species, Humidity from inputs
- Type and Processing may change based on process (e.g., after planing → "Planed")
- Dimensions may be modified (e.g., thickness reduced after planing)
**And** I can adjust all values as needed

**Given** I am adding output lines manually
**When** I click "+ Add Output"
**Then** a new row is added following the standard 14-column layout with all attribute dropdowns and dimension inputs
**And** the package number is auto-generated (internal production number)
**And** volume auto-calculates when all dimensions and pieces are single numbers

**Given** I am editing output lines
**When** I need the same values for multiple outputs
**Then** I can use "Copy Row" to duplicate with new package number
**Or** I can use "Apply to All" for specific attributes

**Given** I have added output lines
**When** I view the outputs section
**Then** I see all output lines in the standard 14-column table with sort/filter/collapse functionality
**And** I see a running total of output m³
**And** I can remove any output line by clicking delete

**Given** I want to add outputs quickly
**When** I use keyboard shortcut Ctrl+O
**Then** the output entry form opens
**And** the shortcut hint "Ctrl+O" is visibly displayed next to or on the "+ Add Output" button

---

### Story 4.4: Live Production Calculations

**As a** Producer,
**I want** to see live calculations as I enter production data,
**So that** I can verify accuracy before committing.

**Acceptance Criteria:**

**Given** I am entering production inputs and outputs
**When** I add or modify any line item
**Then** the following calculations update immediately:
- Total Input m³
- Total Output m³
- Outcome % (output/input × 100)
- Waste % (100 - outcome %)

**Given** I am viewing the production form
**When** I look at the summary section
**Then** I see a ProductionSummary component displaying all calculated metrics
**And** metrics are color-coded (e.g., outcome % shows green if >80%, yellow if 60-80%, red if <60%)

**Given** inputs total 10 m³ and outputs total 8.5 m³
**When** I view the summary
**Then** Outcome % shows 85%
**And** Waste % shows 15%

**Given** I have no inputs entered yet
**When** I view calculations
**Then** metrics show "--" or "0" and don't show errors

---

### Story 4.5: Validate Production & Update Inventory

**As a** Producer,
**I want** to validate and commit my production entry,
**So that** inventory is updated and the production is recorded permanently.

**Acceptance Criteria:**

**Given** I have a complete production entry (inputs + outputs)
**When** I click "Validate"
**Then** I see a confirmation dialog showing:
- Summary of input packages (count, total m³ to be consumed)
- Summary of output packages (count, total m³ to be created)
- Calculated outcome % and waste %
- Warning if outcome % is unusual (<50% or >100%)

**Given** I am on the validation confirmation
**When** I confirm by clicking "Validate & Commit"
**Then** the production entry status changes from "draft" to "validated"
**And** input packages have pieces/m³ deducted (or removed if fully consumed)
**And** output packages are created as new inventory records
**And** output package numbers are finalized (production-based format)
**And** `validated_at` timestamp is set
**And** I see success toast "Production validated successfully"
**And** I am redirected to production history

**Given** input package is fully consumed (all pieces used)
**When** production is validated
**Then** the input package record is marked as consumed (quantity = 0 or flagged)
**And** it remains in history but not in available inventory

**Given** I partially consume a package (use some but not all pieces)
**When** production is validated
**Then** the package's pieces are reduced by the consumed amount
**And** the remaining pieces stay in available inventory

**Given** input package is partially consumed
**When** production is validated
**Then** the package's pieces and m³ are reduced by consumed amount
**And** remaining inventory is still available for future production

**Given** I try to validate without any inputs
**When** I click "Validate"
**Then** I see an error "At least one input is required"

**Given** I try to validate without any outputs
**When** I click "Validate"
**Then** I see an error "At least one output is required"

**Given** I want to cancel validation
**When** I click "Cancel" on the confirmation dialog
**Then** I return to the production form with no changes made
**And** entry remains in "draft" status

**Given** I press Ctrl+Enter
**When** I have a valid production entry
**Then** the validation dialog opens
**And** the shortcut hint "Ctrl+Enter" is visibly displayed on the "Validate" button

---

---

## Epic 5: Production Insights & History

**Goal:** Producer can view production history within the Production page, request corrections (with admin approval); Admin can view producer efficiency reports

**FRs covered:** FR45, FR46, FR51, FR52

---

### Story 5.1: Production Page Tabs (Active + History)

**As a** Producer,
**I want** to view my production history alongside active entries,
**So that** I can review past production entries without navigating away from the Production section.

**Acceptance Criteria:**

**Given** I am logged in as Producer
**When** I navigate to Production
**Then** I see two tabs: "Active" and "History"
**And** the "Active" tab shows draft entries (current behavior)
**And** the "History" tab shows validated production entries

**Given** I am on the "History" tab
**When** I view the history table
**Then** I see columns: Date, Process Type, Input m³, Output m³, Outcome %, Waste %
**And** entries are sorted by date (newest first) by default
**And** I can click column headers to sort by any column

**Given** I am viewing production history
**When** I use the date filter
**Then** I can filter to a specific date range
**And** the table updates to show only matching entries

**Given** I am viewing production history
**When** I use the process filter dropdown
**Then** I can filter by process type
**And** the table shows only entries for that process

**Given** I click on a history row
**When** the detail view opens
**Then** I see full details: all input lines, all output lines, calculations (read-only)
**And** I see a "Request Correction" button (if the entry is eligible for correction)

**Given** no validated entries exist
**When** I view the "History" tab
**Then** I see an empty state "No production history yet"

---

### Story 5.2: Production Corrections

**As a** Producer,
**I want** to create a correction entry to fix a mistake in a past production,
**So that** inventory is adjusted correctly while maintaining a full audit trail.

**Design Principle:** Validated entries are permanent — they are never edited or voided. A correction is a new production entry (like a reverse journal in accounting) that adjusts inventory to the correct state. It follows the same flow as a normal production (inputs, outputs, validate) but is flagged as a correction and linked to the original entry.

**Acceptance Criteria:**

**Given** I am viewing a validated production entry in history
**When** I click "Create Correction"
**Then** a new production entry is created with type "correction"
**And** it is linked to the original entry (reference)
**And** I am taken to the correction entry form (same layout as normal production)

**Given** I am creating a correction entry
**When** I add inputs and outputs
**Then** the form works exactly like a normal production entry
**And** I can add any available inventory packages as inputs
**And** I can define output packages as normal
**And** live calculations update (input m³, output m³, outcome %)

**Given** I have completed a correction entry
**When** I click "Validate"
**Then** the same validation flow as a normal production runs (inputs deducted, outputs created)
**And** the entry status changes to "validated"
**And** I see a success toast and am redirected to the production page

**Given** a correction entry is validated
**When** I view it in history
**Then** it appears with a "Correction" badge
**And** it links to the original entry it corrects
**And** it is included in efficiency calculations like any other entry

---

### Story 5.3: Producer Dashboard Metrics

**As a** Producer,
**I want** to see efficiency metrics on my dashboard,
**So that** I can understand my production performance at a glance.

**Acceptance Criteria:**

**Given** I am logged in as Producer
**When** I view my dashboard
**Then** I see MetricCards displaying:
- Total Inventory (current m³)
- Total Production Volume (all-time output m³)
- Overall Outcome % (weighted average across all production)
- Overall Waste % (weighted average)

**Given** production history exists
**When** I view the dashboard
**Then** I see a per-process breakdown table showing:
- Process Name
- Total Entries
- Total Input m³
- Total Output m³
- Average Outcome %
- Average Waste %

**Given** I am viewing per-process metrics
**When** I look at individual process rows
**Then** metrics are color-coded:
- Green: Outcome % >= 80%
- Yellow: Outcome % 60-79%
- Red: Outcome % < 60%

**Given** no production has been recorded yet
**When** I view the dashboard
**Then** metrics show "0" or "--" appropriately
**And** I see a prompt "Start tracking production to see metrics"

**Given** I click on a process in the breakdown table
**When** the action completes
**Then** I am taken to Production page > History tab filtered by that process

---

### Story 5.4: Admin Efficiency Reports

**As an** Admin,
**I want** to view producer efficiency reports,
**So that** I can monitor production performance and identify improvements.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I view my dashboard
**Then** I see an "Efficiency Overview" section
**And** I see summary metrics: Total Production Volume, Overall Outcome %, Overall Waste %

**Given** production data exists
**When** I view the Admin dashboard
**Then** I see a per-process efficiency table showing:
- Process Name
- Total Entries
- Total Input m³
- Total Output m³
- Outcome %
- Waste %
- Trend indicator (compared to previous period)

**Given** I am viewing efficiency reports
**When** I use the date range filter
**Then** I can view metrics for: This Week, This Month, This Quarter, All Time, Custom Range
**And** all metrics recalculate for the selected period

**Given** I am viewing per-process metrics
**When** I click on a process row
**Then** I see a detailed view with:
- Chart showing outcome % over time
- List of recent production entries for that process
- Best and worst performing entries

**Given** I want to export data
**When** I click "Export"
**Then** I can download efficiency data as CSV
**And** export includes: Date, Process, Input m³, Output m³, Outcome %, Waste %

**Given** no production data exists
**When** I view Admin dashboard
**Then** I see a message "No production data recorded yet"
**And** the efficiency section shows placeholder state

---
---

# Multi-Tenancy Extension (Epics 6-9)

**Date Added:** 2026-01-25
**Source:** Brainstorming session + Architecture Addendum
**Builds On:** Producer MVP (Epics 1-5)

## New Requirements (Multi-Tenancy)

### From Architecture Addendum (2026-01-25)

**Multi-Tenancy Requirements:**
- Add organisation_id to portal_users and inventory_packages
- Context-driven views (same forms, filtered by session org)
- Organization-scoped login and data visibility

**User Management Requirements:**
- Super Admin creates organizations
- Super Admin creates users within organizations
- Organizations may have 0+ users (no type distinction)
- User onboarding with credential sending

**Shipment Flow Requirements:**
- Two-stage flow: Draft → Pending → Accept/Reject → Complete
- Extend existing shipments table with status workflow
- Shipment codes: [FROM]-[TO]-[NUMBER]
- Inventory moves only on completion

**Consolidated Views Requirements:**
- Platform-wide dashboard with aggregated metrics
- Per-org breakdown with drill-down
- Shipments view showing all cross-org activity

### New FR Coverage Map (Epics 6-9)

| Requirement | Epic | Description |
|-------------|------|-------------|
| Arch: organisation_id on tables | Epic 6 | Data model extension for multi-tenancy |
| Arch: Context-driven views | Epic 6 | Same forms, filtered by session org |
| Arch: Org-scoped login | Epic 6 | Users belong to one organization |
| Arch: User creation in org | Epic 7 | Super Admin creates users per org |
| Arch: Credential sending | Epic 7 | Email with login details |
| Arch: Orgs with 0+ users | Epic 7 | No type distinction needed |
| Arch: Two-stage shipment flow | Epic 8 | Draft → Accept → Execute |
| Arch: Shipment status workflow | Epic 8 | Extend shipments table |
| Arch: Shipment codes | Epic 8 | FROM-TO-NUMBER format |
| Arch: Aggregated dashboard | Epic 9 | Platform-wide metrics |
| Arch: Shipments view | Epic 9 | Cross-org activity log |
| Arch: Per-org drill-down | Epic 9 | View org as they see it |

---

## Epic 6: Multi-Tenancy Foundation

**Goal:** Organization users see only their organization's data; Super Admin can view all or filter by organization

**Requirements covered:**
- Add organisation_id to portal_users and inventory_packages
- Context-aware queries (filter by session's org)
- Organization-scoped login and dashboard

**Standalone Value:** Complete data isolation - users log in and see only their org's inventory and production.

---

### Story 6.1: Database Schema for Multi-Tenancy

> **Extended by Story 10.1** (adds organization types, memberships, features, roles, permissions tables)
> **User model superseded by Story 10.5** (single org_id → multi-org memberships)

**As a** developer,
**I want** the database schema updated with organisation_id columns,
**So that** all data can be properly scoped to organizations.

**Acceptance Criteria:**

**Given** the existing database schema
**When** migrations are applied
**Then** `portal_users` table has `organisation_id` column (nullable, FK to organisations)
**And** `inventory_packages` table has `organisation_id` column (FK to organisations)
**And** `portal_production_entries` table has `organisation_id` column (FK to organisations)
**And** existing data is migrated to the default organisation (TWP)
**And** Super Admin user (existing admin) has `organisation_id = NULL`

---

### Story 6.2: Organization-Scoped Authentication

> **Superseded by Story 10.6** (enhanced session with multi-org memberships, current_organization switcher)

**As an** organization user,
**I want** my session to include my organization context,
**So that** I automatically see only my organization's data.

**Acceptance Criteria:**

**Given** I am a user with `organisation_id` set
**When** I log in
**Then** my session includes `organisation_id` and `organisation_code`
**And** the sidebar shows my organization name

**Given** I am a Super Admin (organisation_id = NULL)
**When** I log in
**Then** my session has `organisation_id = null`
**And** the sidebar shows "Timber World Platform"

**Given** I try to access a route
**When** middleware checks my session
**Then** organisation context is available for all server actions

---

### Story 6.3: Context-Aware Inventory Queries

**As an** organization user,
**I want** to see only my organization's inventory,
**So that** I work with relevant data only.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** I view the Inventory page
**Then** I see only packages where `organisation_id` matches my organization
**And** summary totals reflect only my organization's packages

**Given** I am logged in as Super Admin
**When** I view the Inventory page
**Then** I see packages from all organizations
**And** each row shows which organization owns the package

**Given** packages exist for multiple organizations
**When** an organization user views inventory
**Then** they cannot see packages from other organizations

---

### Story 6.4: Context-Aware Production Queries

**As an** organization user,
**I want** to see only my organization's production entries,
**So that** my production history is scoped to my facility.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** I view the Production page (Active or History tab)
**Then** I see only production entries where `organisation_id` matches my organization

**Given** I am logged in as an organization user
**When** I create a new production entry
**Then** the entry is automatically assigned my `organisation_id`

**Given** I am logged in as Super Admin
**When** I view production entries
**Then** I see entries from all organizations
**And** I can filter by organization

---

### Story 6.5: Organization Selector for Super Admin

> **Extended by Story 10.7** (org switcher for multi-org users) and **Story 10.14** (View As impersonation)

**As a** Super Admin,
**I want** to filter all views by organization,
**So that** I can focus on one organization's data when needed.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I view the dashboard header
**Then** I see an organization dropdown (default: "All Organizations")

**Given** I select a specific organization from the dropdown
**When** the selection changes
**Then** all data views (Inventory, Production, Dashboard) filter to that organization
**And** the URL includes `?org={org_id}` for bookmarking

**Given** I select "All Organizations"
**When** the selection changes
**Then** all views show aggregated data across all organizations

**Given** I am an organization user (not Super Admin)
**When** I view any page
**Then** I do not see the organization selector (my org is fixed)

---

## Epic 7: User & Organization Management

**Goal:** Super Admin can create organizations and assign users to them; users receive login credentials

**Requirements covered:**
- Extend organisations management (single type for all)
- User CRUD within organization context
- Credential sending (email with login details)
- Organizations may have 0+ users

**Standalone Value:** Full user lifecycle - Super Admin onboards new orgs and users. Builds on Epic 6.

---

### Story 7.1: Enhanced Organizations Management

> **Extended by Story 10.12** (organization feature configuration) and **Story 10.13** (organization type management)

**As a** Super Admin,
**I want** to manage organizations with user count visibility,
**So that** I can see which organizations have users and which don't.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I navigate to Admin > Organisations
**Then** I see a table with columns: Code, Name, User Count, Status, Actions

**Given** I am viewing the organisations table
**When** an organization has 0 users
**Then** the User Count shows "0" (not an error state)
**And** I can still create shipments to/from this organization

**Given** I click on an organization row
**When** the detail view opens
**Then** I see a "Users" tab alongside organization details

**Given** I am an organization user (not Super Admin)
**When** I try to access Admin > Organisations
**Then** I am redirected with "Access denied" message

---

### Story 7.2: User Management within Organization

> **Extended by Story 10.10** (role assignment) and **Story 10.11** (permission overrides)

**As a** Super Admin,
**I want** to create and manage users within an organization,
**So that** I can onboard new organization staff.

**Acceptance Criteria:**

**Given** I am viewing an organization's Users tab
**When** I click "Add User"
**Then** I see a form with fields: Name (required), Email (required)

**Given** I am adding a new user
**When** I enter valid name and email and click Save
**Then** a new user record is created with `organisation_id` set to this organization
**And** the user's role is set to "producer" by default
**And** I see a success message "User created"

**Given** I try to add a user with an email that already exists
**When** I click Save
**Then** I see an error "Email already registered"

**Given** I am viewing the Users tab
**When** I see the user list
**Then** I see columns: Name, Email, Status (Active/Invited), Last Login, Actions

**Given** I click Edit on a user
**When** I modify their name and save
**Then** the user's name is updated
**And** I see a success toast

**Given** I click Deactivate on a user
**When** I confirm the action
**Then** the user is marked inactive
**And** they can no longer log in

---

### Story 7.3: User Credential Generation

**As a** Super Admin,
**I want** to generate login credentials for new users,
**So that** they can access the portal.

**Acceptance Criteria:**

**Given** I have created a new user
**When** the user is saved
**Then** a temporary password is auto-generated (12+ chars, mixed case, numbers)
**And** the user status is set to "Invited"

**Given** a user has status "Invited"
**When** I view their row in the Users table
**Then** I see a "Send Credentials" button

**Given** I click "Send Credentials"
**When** the action completes
**Then** an email is sent to the user with: login URL, email, temporary password
**And** I see a success toast "Credentials sent to {email}"
**And** `invited_at` timestamp is recorded

**Given** the user logs in with the temporary password
**When** they successfully authenticate
**Then** their status changes from "Invited" to "Active"

---

### Story 7.4: Resend and Reset Credentials

**As a** Super Admin,
**I want** to resend or reset user credentials,
**So that** I can help users who lost access.

**Acceptance Criteria:**

**Given** a user has status "Invited" (never logged in)
**When** I click "Resend Credentials"
**Then** a new temporary password is generated
**And** the email is sent again with new credentials

**Given** a user has status "Active" (has logged in before)
**When** I click "Reset Password"
**Then** a new temporary password is generated
**And** the user receives an email with reset instructions
**And** their next login requires the new password

**Given** I want to view credential send history
**When** I view a user's details
**Then** I see when credentials were last sent (`invited_at`)
**And** I see who sent them (`invited_by`)

---

## Epic 8: Inter-Organization Shipments

**Goal:** Organizations can send inventory to each other with a review/approval process

**Requirements covered:**
- Two-stage shipment flow: Draft → Pending ("On The Way") → Accept/Reject → Complete
- Shipment creation with package selection
- Receiver acceptance/rejection workflow
- Inventory movement on completion only
- Pallet grouping for physical organization of packages (Added 2026-02-06)
- On-the-way status tracking with admin visibility (Added 2026-02-06)
- Bidirectional draft blocking (production ↔ shipment) (Added 2026-02-06)

**Standalone Value:** Complete goods movement between orgs. Builds on Epics 6-7.

**Note:** This extends the existing `shipments` table with status workflow for inter-org movements.

**Enhancement (2026-02-06):** Added pallet grouping (`shipment_pallets` table), renamed "Pending" to "On The Way" throughout UI, added draft blocking between production and shipment workflows, packages removed from sender inventory when marked "On The Way".

---

### Story 8.1: Shipment Schema for Inter-Org Flow

**As a** developer,
**I want** the shipments table extended for inter-org workflows,
**So that** shipments between organizations include approval flow.

**Acceptance Criteria:**

**Given** the existing `shipments` table
**When** migrations are applied
**Then** `shipments` table has additional columns:
- status (TEXT: draft, pending, accepted, completed, rejected) - default 'completed' for legacy
- submitted_at (TIMESTAMPTZ, nullable)
- reviewed_at, reviewed_by (for acceptance/rejection)
- rejection_reason (TEXT, nullable)
- completed_at (TIMESTAMPTZ, nullable)

**And** `shipment_packages` table (existing) supports partial quantities:
- pieces (INTEGER) - pieces being shipped
- volume_m3 (DECIMAL) - volume being shipped

**And** existing shipments are marked with status = 'completed' (no approval needed for legacy data)

**Enhancement (2026-02-06):** Additional schema for pallet grouping:

**Given** the pallet feature is implemented
**When** migrations are applied
**Then** `shipment_pallets` table is created with:
- id (UUID, PK)
- shipment_id (UUID, FK to shipments, ON DELETE CASCADE)
- pallet_number (INTEGER, sequential within shipment)
- notes (TEXT, nullable)
- UNIQUE(shipment_id, pallet_number)

**And** `inventory_packages` table has:
- pallet_id (UUID, FK to shipment_pallets, ON DELETE SET NULL)

---

### Story 8.2: Create Shipment Draft

**As an** organization user,
**I want** to create a shipment draft and select packages,
**So that** I can prepare a shipment to another organization.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** I navigate to Shipments and click "New Shipment"
**Then** I see a form with: To Organisation (dropdown), Notes (optional)

**Given** I am creating a shipment
**When** I select a destination organization
**Then** the shipment code is auto-generated (e.g., "INE-TWP-001")
**And** a draft shipment record is created

**Given** I have a draft shipment
**When** I click "Add Packages"
**Then** I see a package selector showing my organization's available inventory
**And** I can select multiple packages with quantities (pieces/volume)

**Given** I have selected packages
**When** I view the shipment draft
**Then** I see all selected packages with: Pallet, Package#, Product, Dimensions, Pieces, Volume
**And** I see totals: Total Packages, Total m³

**Given** I have a draft shipment
**When** I remove a package from the selection
**Then** the package is unlinked from the shipment (not deleted)
**And** the package returns to available inventory
**And** totals are recalculated

**Enhancement (2026-02-06):** Pallet grouping:

**Given** I am viewing a shipment draft
**When** I click the Pallet dropdown on a package row
**Then** I see options: "-" (without pallet), "Pallet 1", "Pallet 2", ..., "+ New Pallet"

**Given** I select "+ New Pallet"
**When** the action completes
**Then** a new pallet is created with next sequential number
**And** the package is assigned to the new pallet

**Given** packages are assigned to pallets
**When** I view the shipment draft
**Then** packages are grouped by pallet with per-pallet subtotals
**And** packages without a pallet appear in "Without Pallet" section

**Enhancement (2026-02-06):** Draft blocking:

**Given** a package is in a production draft (selected as input)
**When** I open the package selector for shipment
**Then** the package appears in the list but is disabled (grayed out)
**And** the package shows a FileText icon indicating production draft
**And** the package cannot be selected for shipment

---

### Story 8.3: Submit Shipment for Acceptance

**As an** organization user,
**I want** to submit my shipment draft for receiver approval,
**So that** the receiving organization can review before goods move.

**Acceptance Criteria:**

**Given** I have a draft shipment with at least one package
**When** I click "On The Way" (with truck icon)
**Then** I see a confirmation dialog showing: destination org, package count, total m³

**Given** I confirm the submission
**When** the action completes
**Then** shipment status changes from "draft" to "pending"
**And** `submitted_at` timestamp is set
**And** I see success message "Shipment is on the way"

**Given** a shipment is pending ("On The Way")
**When** I view it
**Then** I can no longer add or remove packages
**And** I see status "On The Way" (not "Pending")
**And** I see a "Cancel" button (returns to draft)

**Given** I try to submit a shipment with no packages
**When** I click "On The Way"
**Then** I see error "At least one package is required"

**Enhancement (2026-02-06):** Inventory lifecycle changes:

**Given** a shipment is marked "On The Way"
**When** the status changes to pending
**Then** packages are removed from sender's inventory view
**And** packages appear in admin inventory with truck icon and amber background
**And** hovering the truck icon shows "From Org → To Org"

**Given** a package is in a pending shipment
**When** viewed in producer inventory
**Then** the package is NOT visible (excluded from query)

---

### Story 8.4: Receiver Reviews Pending Shipment

**As an** organization user (receiver),
**I want** to see and review incoming shipment requests,
**So that** I can verify what I'm receiving before accepting.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** a shipment is pending with my organization as destination
**Then** I see a notification indicator on the Shipments menu

**Given** I navigate to Shipments
**When** I view the "Incoming" tab
**Then** I see all pending shipments addressed to my organization
**And** columns show: Code, From Org, Packages, Volume m³, Submitted Date, Actions

**Given** I click on a pending shipment
**When** the detail view opens
**Then** I see full package list with all attributes
**And** I see sender's notes (if any)
**And** I see "Accept" and "Reject" buttons

**Given** I am Super Admin
**When** I view Shipments
**Then** I can see all pending shipments across all organizations

---

### Story 8.5: Accept or Reject Shipment

**As an** organization user (receiver),
**I want** to accept or reject an incoming shipment,
**So that** I control what inventory enters my organization.

**Acceptance Criteria:**

**Given** I am viewing a pending shipment addressed to my organization
**When** I click "Accept"
**Then** I see a confirmation dialog "Accept X packages (Y m³) from {Org}?"

**Given** I confirm acceptance
**When** the action completes
**Then** shipment status changes to "accepted"
**And** `reviewed_at` and `reviewed_by` are set
**And** inventory packages are moved: `organisation_id` updated to my org
**And** shipment status changes to "completed"
**And** `completed_at` is set
**And** sender sees the shipment as "Completed"

**Given** I click "Reject"
**When** I am prompted
**Then** I must enter a rejection reason (required)

**Given** I confirm rejection with a reason
**When** the action completes
**Then** shipment status changes to "rejected"
**And** `rejection_reason` is saved
**And** packages remain with sender (no inventory movement)
**And** sender sees the shipment as "Rejected" with the reason

---

### Story 8.6: Shipment History and Status Tracking

**As an** organization user,
**I want** to view my shipment history,
**So that** I can track what I've sent and received.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** I navigate to Shipments
**Then** I see tabs: "Outgoing" (sent by my org), "Incoming" (sent to my org)

**Given** I am viewing the Outgoing tab
**When** I see the table
**Then** I see columns: Code, To Org, Packages, Volume m³, Status, Date
**And** status shows: Draft, On The Way, Completed, Rejected

**Given** I am viewing the Incoming tab
**When** I see the table
**Then** I see columns: Code, From Org, Packages, Volume m³, Status, Date
**And** "On The Way" shipments are highlighted

**Given** I click on any shipment
**When** the detail view opens
**Then** I see full shipment details including all packages grouped by pallet
**And** if rejected, I see the rejection reason

**Given** I am Super Admin
**When** I view Shipments
**Then** I see an "All Shipments" tab showing shipments between all organizations

**Enhancement (2026-02-06):** Shipment entry display format:

**Given** I am viewing the shipments list
**When** I see a shipment entry
**Then** the format shows: "CODE  From Org → To Org" (e.g., "TIM-TWG-001  Timber International → The Wooden Good")

---

## Epic 9: Consolidated Platform Views

**Goal:** Super Admin sees platform-wide metrics and all cross-org shipments in one view

**Requirements covered:**
- Aggregated dashboard (totals across all orgs)
- Per-org breakdown with drill-down
- Shipments view showing all cross-org activity
- Each org also sees their own shipments (sent/received)

**Standalone Value:** Complete visibility for Super Admin. Builds on Epics 6-8.

---

### Story 9.1: Super Admin Aggregated Dashboard

**As a** Super Admin,
**I want** to see platform-wide metrics on my dashboard,
**So that** I can monitor all organizations at a glance.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I view my dashboard
**Then** I see aggregated MetricCards:
- Total Inventory Volume (all orgs combined, m³)
- Total Production Volume (all orgs combined, m³)
- Active Organizations (count of orgs with recent activity)
- Pending Shipments (count awaiting acceptance)

**Given** production data exists across multiple organizations
**When** I view the dashboard
**Then** I see Overall Outcome % and Waste % (weighted across all orgs)

**Given** I view the dashboard
**When** I look at the efficiency section
**Then** I see per-process breakdown aggregated across all organizations

---

### Story 9.2: Per-Organization Breakdown

**As a** Super Admin,
**I want** to see a breakdown by organization,
**So that** I can compare performance across my network.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I view the dashboard
**Then** I see an "Organizations Overview" table with columns:
- Organization Name
- Inventory (m³)
- Production Volume (m³)
- Outcome %
- Last Activity

**Given** I am viewing the Organizations Overview
**When** I click on an organization row
**Then** I am taken to that organization's detailed view
**And** I see their dashboard as they would see it

**Given** I am viewing an organization's detail view
**When** I look at the header
**Then** I see "Viewing as: {Org Name}" indicator
**And** I see a "Back to Platform View" link

**Given** organizations have varying performance
**When** I view the breakdown
**Then** Outcome % is color-coded (green ≥80%, yellow 60-79%, red <60%)

---

### Story 9.3: All Shipments View

**As a** Super Admin,
**I want** to see all shipments across the platform,
**So that** I can track goods movement between all organizations.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I navigate to Shipments
**Then** I see an "All Shipments" tab (in addition to Incoming/Outgoing)

**Given** I am viewing the All Shipments tab
**When** I see the table
**Then** I see columns: Code, From Org, To Org, Packages, Volume m³, Status, Date
**And** shipments are sorted by date (newest first)

**Given** I am viewing All Shipments
**When** I use the filter options
**Then** I can filter by: From Org, To Org, Status, Date Range

**Given** I click on any shipment row
**When** the detail view opens
**Then** I see full shipment details including all packages
**And** I can see acceptance/rejection history

**Given** pending shipments exist
**When** I view All Shipments
**Then** pending shipments are visually highlighted
**And** I see a count badge on the tab "All Shipments (3)"

---

### Story 9.4: Organization User Shipments View

**As an** organization user,
**I want** to see my sent and received shipments,
**So that** I can track my organization's goods movement.

**Acceptance Criteria:**

**Given** I am logged in as an organization user
**When** I navigate to Shipments
**Then** I see two tabs: "Outgoing" and "Incoming"
**And** I do NOT see the "All Shipments" tab (Super Admin only)

**Given** I am viewing Outgoing shipments
**When** I see the table
**Then** I see only shipments where my org is the sender
**And** columns show: Code, To Org, Packages, Volume m³, Status, Date

**Given** I am viewing Incoming shipments
**When** I see the table
**Then** I see only shipments where my org is the receiver
**And** columns show: Code, From Org, Packages, Volume m³, Status, Date
**And** pending shipments show action buttons (Accept/Reject)

**Given** I have pending incoming shipments
**When** I view the Shipments menu item
**Then** I see a notification badge with the count

---
---

# Epic 10: Platform Foundation v2 (Multi-Org Upgrade)

**Date Added:** 2026-02-01
**Source:** Multi-Tenant Architecture Design session + Architecture Addendum v2
**Builds On:** Producer MVP (Epics 1-5) + Multi-Tenancy Extension (Epics 6-9)
**Relationship to Epics 6-7:** This epic *evolves* the single-org model from Epics 6-7 into a full multi-org platform. It is additive (not replacement) - existing functionality keeps working while new capabilities are added.

## New Requirements (Platform Foundation v2)

### From Architecture Addendum (2026-02-01)

**Organization Model:**
- Organization types as tags (Principal, Producer, Supplier, Client, Trader, Logistics)
- Organizations can have multiple types (e.g., a company can be both Producer and Supplier)
- All organizations are peers from IT perspective

**Multi-Org Membership:**
- Users can belong to multiple organizations
- Organization switcher for users with multiple memberships
- Primary organization concept for defaults

**Permission Model (Three Layers):**
1. Organization Features - what the org has access to
2. Roles - bundles of permissions assigned to users
3. User Overrides - per-user permission additions/removals

**Super Admin Features:**
- "View As" impersonation for organizations and users
- Full audit trail for impersonation actions

### New Requirement Coverage Map (Epic 10)

| Requirement | Story | Description |
|-------------|-------|-------------|
| Arch: organization_types table | 10.1 | Types as tags, not classes |
| Arch: multi-org membership | 10.1 | organization_memberships table |
| Arch: three-layer permissions | 10.1 | features, roles, overrides tables |
| Arch: org type seeding | 10.2 | 6 standard types |
| Arch: features registry | 10.3 | All platform features registered |
| Arch: default roles | 10.4 | System roles for common use cases |
| Arch: user migration | 10.5 | Existing users to membership model |
| Arch: session context | 10.6 | Multi-org aware sessions |
| Arch: org switcher | 10.7 | Switch between memberships |
| Arch: permission checking | 10.8 | Three-layer resolution |
| Arch: role management | 10.9 | CRUD for roles |
| Arch: role assignment | 10.10 | Assign roles to users |
| Arch: permission overrides | 10.11 | Per-user fine-tuning |
| Arch: org feature config | 10.12 | Enable/disable per org |
| Arch: org type management | 10.13 | Assign types to orgs |
| Arch: view as org | 10.14 | Impersonate organization |
| Arch: view as user | 10.15 | Impersonate user |
| Arch: audit trail | 10.16 | Log all impersonation |

---

## Epic 10: Platform Foundation v2 (Multi-Org Upgrade)

**Goal:** Evolve the single-org model from Epics 6-7 into a full multi-org platform with organization types, multi-org user membership, granular roles/permissions, and Super Admin impersonation

**Architecture Reference:** `planning-artifacts/platform/architecture.md` (Platform Multi-Tenant Architecture v2 Addendum)

**Analysis Reference:** `analysis/multi-tenant-architecture-design-2026-02-01.md`

**Requirements covered:**
- Organization types as tags with feature defaults
- Multi-org user membership with switcher
- Three-layer permission model (org features → roles → user overrides)
- Super Admin "View As" impersonation with audit trail

**Relationship to existing epics:**
| This Epic | Relationship | Earlier Epic |
|-----------|--------------|--------------|
| 10.1 | Extends | 6.1 (adds new tables alongside existing) |
| 10.5 | Supersedes | 6.1 user model (single org → multi-org memberships) |
| 10.6 | Supersedes | 6.2 (enhanced session with memberships) |
| 10.7 | Extends | 6.5 (org switcher for all multi-org users) |
| 10.10-10.11 | Extends | 7.2 (adds roles and permission overrides) |
| 10.12-10.13 | Extends | 7.1 (adds feature config and type management) |
| 10.14 | Extends | 9.2 (View As impersonation) |

**Standalone Value:** Complete multi-tenant foundation enabling all future portal features (Client Portal, Supplier Portal, Sales Portal, etc.)

---

### Story 10.1: Database Schema - Core Tables

> **Extends Story 6.1** - Adds new tables alongside existing schema (organization_types, memberships, features, roles, permissions). Does not modify existing tables except adding `is_platform_admin` to portal_users.

**As a** developer,
**I want** all new multi-tenant tables created in the database,
**So that** the foundation exists for the new architecture.

**Acceptance Criteria:**

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

---

### Story 10.2: Seed Organization Types

**As a** Super Admin,
**I want** organization types pre-populated in the system,
**So that** I can assign types to organizations.

**Acceptance Criteria:**

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

---

### Story 10.3: Seed Features Registry

**As a** developer,
**I want** all system features registered in the database,
**So that** they can be enabled/disabled per organization.

**Acceptance Criteria:**

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

---

### Story 10.4: Seed Default Roles

**As a** Super Admin,
**I want** default roles available in the system,
**So that** I can assign them to users.

**Acceptance Criteria:**

**Given** the roles table exists
**When** seed migration runs
**Then** the following system roles exist:

| Role | Description | Permissions |
|------|-------------|-------------|
| Org Admin | Manages users within organization | users.* |
| Production Manager | Full production access | production.*, inventory.view, shipments.view, dashboard.view |
| Inventory Manager | Manages inventory | inventory.*, shipments.*, dashboard.view |
| Viewer | Read-only access | dashboard.view, inventory.view, production.view, shipments.view |
| Full Access | All features (for org owner) | * |

**And** all seeded roles have is_system = true
**And** system roles cannot be deleted (only deactivated)

---

### Story 10.5: Migrate Users to Memberships

> **Supersedes Story 6.1 user model** - Evolves from single `organisation_id` on users to multi-org memberships. Existing org_id is preserved for backward compatibility; memberships table becomes the source of truth.

**As a** developer,
**I want** existing users migrated to the membership model,
**So that** multi-org support works with existing data.

**Acceptance Criteria:**

**Given** users exist with organisation_id set
**When** migration runs
**Then** for each user with organisation_id:
- A record is created in organization_memberships
- is_primary = true (their only org becomes primary)
- is_active = true

**And** the current Super Admin (admin role, org_id = null):
- Gets is_platform_admin = true
- No membership record (platform-level user)

**And** existing user sessions continue to work
**And** the organisation_id column on portal_users is kept for backward compatibility during transition

---

### Story 10.6: Update Session Context

> **Supersedes Story 6.2** - Enhances session from single org context to multi-org aware. Session now includes all memberships and current_organization (switchable). Backward compatible: single-org users work exactly as before.

**As a** user,
**I want** my session to include my organization memberships,
**So that** I can work in the context of my organization(s).

**Acceptance Criteria:**

**Given** I log in successfully
**When** my session is created
**Then** the session includes:
```typescript
{
  user_id: string;
  email: string;
  name: string;
  is_platform_admin: boolean;
  current_organization_id: string | null;
  current_organization_code: string | null;
  current_organization_name: string | null;
  memberships: Array<{
    organization_id: string;
    organization_code: string;
    organization_name: string;
    is_primary: boolean;
  }>;
}
```

**And** if I have one membership, current_organization is set to that org
**And** if I have multiple memberships, current_organization is set to my primary org
**And** if I am platform admin, current_organization is null (platform view)

**And** session context is available in:
- Server components via getSession()
- Server actions via getAuthContext()
- Client components via useSession() hook

---

### Story 10.7: Organization Switcher UI

> **Extends Story 6.5** - The Super Admin org filter (6.5) remains for platform-wide filtering. This adds an org switcher for regular users with multiple memberships. Single-org users see no switcher (same as before).

**As a** user with multiple organization memberships,
**I want** to switch between my organizations,
**So that** I can work in the context of each organization.

**Acceptance Criteria:**

**Given** I am logged in with multiple organization memberships
**When** I view the sidebar
**Then** I see my current organization name with a dropdown indicator

**Given** I click on the organization selector
**When** the dropdown opens
**Then** I see all my organization memberships
**And** my current organization is highlighted
**And** each option shows organization code and name

**Given** I select a different organization
**When** I click on it
**Then** my current_organization_id is updated in session/cookie
**And** the page refreshes with the new organization context
**And** all data views now show that organization's data

**Given** I have only one organization membership
**When** I view the sidebar
**Then** I see my organization name without dropdown (not clickable)

**Given** I am a Platform Admin
**When** I view the sidebar
**Then** I see "Timber World Platform" as current context
**And** I have access to the organization filter dropdown (existing behavior)

---

### Story 10.8: Permission Checking Infrastructure

**As a** developer,
**I want** a permission checking system based on the new model,
**So that** access control uses org features, roles, and overrides.

**Acceptance Criteria:**

**Given** the permission tables exist with data
**When** I call hasPermission(userId, orgId, featureCode)
**Then** it calculates effective permissions:
1. Check if org has feature enabled (organization_features)
2. Get all role permissions for user in org (user_roles → roles.permissions)
3. Apply user overrides (user_permission_overrides)
4. Return true if feature is in effective set

**And** a usePermissions() hook is available for client components:
```typescript
const { hasPermission, permissions } = usePermissions();
if (hasPermission('production.create')) { ... }
```

**And** a checkPermission() helper for server actions:
```typescript
export async function createProduction(data) {
  const ctx = await getAuthContext();
  if (!ctx.hasPermission('production.create')) {
    return { success: false, error: 'Permission denied' };
  }
  // ... proceed
}
```

**And** permission checks are cached per request to avoid repeated DB queries

---

### Story 10.9: Role Management UI

**As a** Super Admin,
**I want** to view and manage roles,
**So that** I can customize permission bundles.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I navigate to Admin > Roles
**Then** I see a table of all roles with columns:
- Name
- Description
- Permission Count
- System (yes/no)
- Actions

**Given** I click "Add Role"
**When** the form opens
**Then** I can enter: Name, Description
**And** I can select permissions from a categorized checkbox list
**And** I can save the new role

**Given** I edit an existing role
**When** I modify permissions and save
**Then** the role is updated
**And** users with this role get updated permissions immediately

**Given** I try to delete a system role
**When** I click delete
**Then** I see an error "System roles cannot be deleted"

**Given** I delete a custom role that has users assigned
**When** I confirm deletion
**Then** I see a warning with affected user count
**And** upon confirmation, role assignments are removed
**And** the role is deleted

---

### Story 10.10: User Role Assignment

> **Extends Story 7.2** - Adds role assignment capability to the existing user management UI. The simple "producer" role default (7.2) is replaced by explicit role assignment using the new roles system.

**As a** Super Admin or Org Admin,
**I want** to assign roles to users within an organization,
**So that** users have appropriate permissions.

**Acceptance Criteria:**

**Given** I am viewing a user in an organization
**When** I click "Manage Roles"
**Then** I see a list of available roles with checkboxes
**And** currently assigned roles are checked

**Given** I check/uncheck roles
**When** I save changes
**Then** user_roles records are updated
**And** user's effective permissions change immediately
**And** I see success toast "Roles updated"

**Given** I am an Org Admin (not Super Admin)
**When** I view the role assignment UI
**Then** I can only assign roles that I have permission to assign
**And** I cannot assign roles with more permissions than I have

**Given** a user has no roles assigned
**When** I view their profile
**Then** they have no permissions (except explicitly granted overrides)

---

### Story 10.11: User Permission Overrides

> **Extends Story 7.2** - Adds per-user permission fine-tuning to the existing user management UI. This is the third layer of the permission model (org features → roles → user overrides).

**As a** Super Admin,
**I want** to add or remove specific permissions for a user,
**So that** I can fine-tune access beyond role templates.

**Acceptance Criteria:**

**Given** I am viewing a user's permissions
**When** I click "Permission Overrides"
**Then** I see:
- Current effective permissions (from roles)
- List of all features with override options: [Inherit] [Grant] [Deny]

**Given** I set a feature to "Grant"
**When** I save
**Then** user gets that permission even if no role provides it
**And** it only works if the org has the feature enabled

**Given** I set a feature to "Deny"
**When** I save
**Then** user loses that permission even if roles provide it

**Given** I set a feature to "Inherit"
**When** I save
**Then** the override is removed
**And** permission comes from roles only

**Given** overrides exist for a user
**When** I view their permissions
**Then** overridden permissions are visually marked (e.g., with + or - icon)

---

### Story 10.12: Organization Feature Configuration

> **Extends Story 7.1** - Adds a "Features" tab to the existing organization detail view. This is the first layer of the permission model (what the org can access).

**As a** Super Admin,
**I want** to configure which features each organization can access,
**So that** different org types have appropriate capabilities.

**Acceptance Criteria:**

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

---

### Story 10.13: Organization Type Management

> **Extends Story 7.1** - Adds type badges and type assignment UI to the existing organization detail view. Types are tags (orgs can have multiple) that drive default feature configuration.

**As a** Super Admin,
**I want** to assign types to organizations,
**So that** they get appropriate default features.

**Acceptance Criteria:**

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

---

### Story 10.14: View As - Organization Impersonation

> **Extends Story 6.5 and 9.2** - Goes beyond filtering (6.5) and per-org breakdown (9.2) to full impersonation. Super Admin sees exactly what org users see, including their navigation and permissions.

**As a** Super Admin,
**I want** to view the portal as any organization,
**So that** I can test and support users.

**Acceptance Criteria:**

**Given** I am logged in as Super Admin
**When** I am in platform view
**Then** I see "View as Organization" button in the header

**Given** I click "View as Organization"
**When** the selector opens
**Then** I see a searchable list of all organizations

**Given** I select an organization
**When** I confirm
**Then** my view switches to that organization's context
**And** I see a banner: "Viewing as: [Org Name] - [Exit View As]"
**And** I see the same sidebar/navigation that org's users see
**And** I see only that org's data
**And** the URL includes ?viewAs=orgId for bookmarking

**Given** I am in View As mode
**When** I click "Exit View As"
**Then** I return to platform admin view
**And** the banner disappears
**And** I see consolidated data again

**Given** I am in View As mode
**When** I perform actions (create, edit, delete)
**Then** actions are performed as that organization
**And** audit log records: actual_user_id = me, acting_as_org_id = org

---

### Story 10.15: View As - User Impersonation

**As a** Super Admin,
**I want** to view the portal as a specific user,
**So that** I can see exactly what they see and debug issues.

**Acceptance Criteria:**

**Given** I am viewing an organization (in View As mode)
**When** I click "View as User"
**Then** I see a list of users in that organization

**Given** I select a user
**When** I confirm
**Then** my view switches to exactly what that user sees
**And** banner shows: "Viewing as: [User Name] @ [Org Name] - [Exit]"
**And** permissions match that user's effective permissions
**And** hidden features are hidden for me too

**Given** I am in user impersonation mode
**When** I toggle "Read-Only Mode"
**Then** I can view but not modify anything
**And** all action buttons are disabled
**And** this is the default for safety

**Given** I disable Read-Only Mode
**When** I perform actions
**Then** they execute as that user would
**And** audit log records: actual_user_id = me, acting_as_user_id = user

**Given** I exit user impersonation
**When** I click "Exit"
**Then** I return to org impersonation level
**And** clicking Exit again returns to platform view

---

### Story 10.16: Audit Trail for Impersonation

**As a** compliance officer,
**I want** all impersonation actions logged,
**So that** there's accountability for Super Admin actions.

**Acceptance Criteria:**

**Given** Super Admin enters View As mode
**When** the mode activates
**Then** an audit record is created:
- event_type: "impersonation_start"
- actual_user_id: Super Admin's ID
- target_org_id: Org being impersonated
- target_user_id: User being impersonated (if applicable)
- timestamp

**Given** Super Admin performs an action while impersonating
**When** the action executes
**Then** the action's audit record includes:
- impersonation_context: { org_id, user_id }
- actual_user_id: Super Admin's ID

**Given** Super Admin exits View As mode
**When** the mode deactivates
**Then** an audit record is created:
- event_type: "impersonation_end"
- duration_seconds: how long impersonation lasted

**Given** I am Super Admin
**When** I view Admin > Audit Log
**Then** I can filter by "Impersonation Actions"
**And** I see all impersonation sessions with details

---

## Epic 10 Dependencies

| Story | Depends On |
|-------|------------|
| 10.2 | 10.1 |
| 10.3 | 10.1 |
| 10.4 | 10.1 |
| 10.5 | 10.1, 10.4 |
| 10.6 | 10.5 |
| 10.7 | 10.6 |
| 10.8 | 10.3, 10.4, 10.6 |
| 10.9 | 10.4 |
| 10.10 | 10.8, 10.9 |
| 10.11 | 10.8 |
| 10.12 | 10.3 |
| 10.13 | 10.2 |
| 10.14 | 10.6 |
| 10.15 | 10.14 |
| 10.16 | 10.14, 10.15 |

---

## Epic 10 Implementation Order (Recommended)

**Phase 1: Database Foundation**
1. Story 10.1 - Core tables
2. Story 10.2 - Org types seed
3. Story 10.3 - Features seed
4. Story 10.4 - Roles seed
5. Story 10.5 - Migrate users

**Phase 2: Session & Context**
6. Story 10.6 - Session context
7. Story 10.7 - Org switcher UI
8. Story 10.8 - Permission checking

**Phase 3: Management UIs**
9. Story 10.9 - Role management
10. Story 10.10 - Role assignment
11. Story 10.11 - Permission overrides
12. Story 10.12 - Org feature config
13. Story 10.13 - Org type management

**Phase 4: Super Admin Tools**
14. Story 10.14 - View As org
15. Story 10.15 - View As user
16. Story 10.16 - Audit trail

---

## Epic 10 Success Criteria

Epic is complete when:
- [ ] All 9 new tables exist with appropriate indexes
- [ ] Organization types are seeded and assignable
- [ ] Features registry is complete with all current features
- [ ] Default roles exist and are assignable
- [ ] Existing users are migrated to memberships
- [ ] Multi-org users can switch organizations
- [ ] Permission checking uses the new 3-layer model
- [ ] Super Admin can configure features per org
- [ ] Super Admin can View As any org/user
- [ ] All impersonation actions are audited
