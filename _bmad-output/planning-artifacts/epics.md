---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - 'planning-artifacts/prd.md'
  - 'planning-artifacts/architecture.md'
  - 'planning-artifacts/ux-design-specification.md'
  - 'planning-artifacts/inventory-data-model-v2.md'
  - 'analysis/brainstorming-session-2026-01-25.md'
scope: 'Producer MVP + Multi-Tenancy Extension'
targetUsers: ['Super Admin', 'Organization User', 'Admin (legacy)', 'Producer (Factory Manager)']
epicCount: 9
storyCount: 38  # 19 original + 19 new (Epics 6-9)
workflowComplete: true
completedDate: '2026-01-25'
status: 'ready-for-implementation'
lastUpdated: '2026-01-25'
updateNote: 'Added Epics 6-9 for Multi-Tenancy, User Management, Shipments, Consolidated Views'
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
- Follow Next.js App Router patterns from marketing app
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
- Two-stage shipment flow: Draft → Pending → Accept/Reject → Complete
- Shipment creation with package selection
- Receiver acceptance/rejection workflow
- Inventory movement on completion only

**Standalone Value:** Complete goods movement between orgs. Builds on Epics 6-7.

**Note:** This extends the existing `shipments` table with status workflow for inter-org movements.

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

**And** `shipment_packages` table (existing) supports partial quantities:
- pieces (INTEGER) - pieces being shipped
- volume_m3 (DECIMAL) - volume being shipped

**And** existing shipments are marked with status = 'completed' (no approval needed for legacy data)

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
**Then** I see all selected packages with: Package#, Product, Dimensions, Pieces, Volume
**And** I see totals: Total Packages, Total m³

**Given** I have a draft shipment
**When** I remove a package from the selection
**Then** the package is removed from the shipment
**And** totals are recalculated

---

### Story 8.3: Submit Shipment for Acceptance

**As an** organization user,
**I want** to submit my shipment draft for receiver approval,
**So that** the receiving organization can review before goods move.

**Acceptance Criteria:**

**Given** I have a draft shipment with at least one package
**When** I click "Submit for Acceptance"
**Then** I see a confirmation dialog showing: destination org, package count, total m³

**Given** I confirm the submission
**When** the action completes
**Then** shipment status changes from "draft" to "pending"
**And** `submitted_at` timestamp is set
**And** I see success message "Shipment submitted for acceptance"

**Given** a shipment is pending
**When** I view it
**Then** I can no longer add or remove packages
**And** I see status "Pending Acceptance"
**And** I see a "Cancel" button (returns to draft)

**Given** I try to submit a shipment with no packages
**When** I click "Submit"
**Then** I see error "At least one package is required"

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
**And** status shows: Draft, Pending, Completed, Rejected

**Given** I am viewing the Incoming tab
**When** I see the table
**Then** I see columns: Code, From Org, Packages, Volume m³, Status, Date
**And** pending shipments are highlighted

**Given** I click on any shipment
**When** the detail view opens
**Then** I see full shipment details including all packages
**And** if rejected, I see the rejection reason

**Given** I am Super Admin
**When** I view Shipments
**Then** I see an "All Shipments" tab showing shipments between all organizations

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
