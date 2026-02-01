---
stepsCompleted: [1, 2, 3, 4, 10, 11, 12, 13, 14]
skippedSteps: [5, 6, 7, 8, 9]
inputDocuments: ['prd.md', 'architecture.md', 'project-context.md']
scope: 'light'
focus: 'Production role MVP'
designSystem: 'shadcn/ui'
status: 'complete'
completedDate: '2026-01-21'
---

# UX Design Specification Timber World Platform

**Author:** Nils
**Date:** 2026-01-21
**Scope:** Light UX - Production Role MVP

---

## Executive Summary

### Project Vision

A desktop production management tool for factory managers to track inventory and log material transformations through configurable production processes.

### Target User

**Factory Manager** - Single user, desktop only, single location

### Core Concept: Transformation-Based Tracking

Materials transform through processes. Product name indicates transformation state:
- "Boards" → Multi-saw → "Strips"
- "Strips" → Planing → "Planed Strips"

No explicit stage tracking needed - the product name carries the transformation history.

### Core Screens (MVP)

1. **Dashboard**
   - Total inventory summary
   - **Per-process metrics: Outcome % and Waste %**
   - **Total Outcome % and Total Waste %**
   - Overall production volumes

2. **Inventory**
   - Table of all products with totals per product type
   - Columns: Product Name, Quantity, Cubic Meters, Sizes
   - Summary row per product type showing totals

3. **Production**
   - Create new OR edit existing production entry
   - Select input from inventory
   - Select process (standard or custom)
   - Enter output product details
   - Auto-calculate: m³ in/out, costs

4. **Production History**
   - List of all completed production processes
   - Columns: Date, Process Type, Input m³, Output m³, Outcome %, Waste %
   - Click any row to view/edit in Production screen

### Process Configuration

Standard: Multi-saw, Planing, Opti-cut, Gluing, Sanding, Finger Jointing
Custom processes can be added by Factory Manager

### Design Scope Exclusions (Future)

- Multi-language support
- Mobile/tablet interfaces
- Multiple user roles
- Timezone handling
- Quality inspection workflows

## Core User Experience

### Defining Experience

The core action is **building and validating a production record**:
- Select multiple input items from inventory (5-15 items typical)
- Select one process
- Record multiple output items
- Review the complete record
- Validate to commit changes to inventory

This is not rapid-fire entry but careful assembly with a final confirmation step.

### Platform Strategy

- Desktop only (mouse/keyboard)
- Single user (Factory Manager)
- Single location, no timezone complexity
- No offline requirements for MVP

### Effortless Interactions

**Smart Output Generation:**
1. Auto-generate output lines from inputs (species, moisture state inherited)
2. Allow "Apply to All" for common values (e.g., all outputs are 45x45)
3. User only manually enters: quantities and exceptions

**Future Enhancement:** Process-specific parameters (e.g., multi-saw sawing width) that auto-suggest output dimensions.

### Critical Success Moments

1. **Adding inputs** - quickly find and select items from inventory
2. **Seeing calculations** - totals update live as items are added
3. **Validation** - one click commits everything, inventory updates immediately
4. **Dashboard reflection** - see the new outcome/waste % immediately after validation

### Experience Principles

1. **Accuracy over speed** - Few entries per day, but they must be correct
2. **Review before commit** - Nothing changes until explicit validation
3. **Reduce repetition** - Auto-fill what can be predicted, user only enters differences
4. **Immediate feedback** - Calculations and totals visible throughout entry

## Desired Emotional Response

### Primary Emotional Goal

**Trust and Confidence** - The Factory Manager should feel certain that data is accurate and the system prevents mistakes.

### Emotional Journey

| Stage | Feeling |
|-------|---------|
| Viewing inventory | Clarity - "I see everything at a glance" |
| Building production entry | Supported - "The system helps me" |
| Before validation | Secure - "I can catch errors first" |
| After validation | Complete - "It's done, recorded correctly" |
| Viewing dashboard | Informed - "I understand my factory's status" |
| Browsing history | In control - "I can review and correct past entries" |

### Emotions to Avoid

- **Anxiety** - Uncertainty about data correctness
- **Confusion** - Not understanding where data went
- **Frustration** - Repetitive manual entry

### Emotional Design Principles

1. **Show before commit** - Preview all changes before validation
2. **Forgiveness** - Allow corrections, show undo options
3. **Transparency** - No hidden calculations or magic numbers
4. **Consistency** - Same patterns across all screens

## Design System

**Component Library:** shadcn/ui (as specified in architecture)

*Note: Steps 5-9 (Inspiration, Design System Choice, Defining Experience, Visual Foundation, Design Directions) skipped for light UX session. Using established shadcn/ui patterns.*

## User Journey Flows

### Production Entry Flow (Core Journey)

The most critical user journey - logging a completed production process.

**Steps:**
1. Click "New Production" → Select process type (or add custom)
2. Add inputs from inventory (5-15 items typical)
3. Add/adjust outputs (auto-generated from inputs)
4. Review summary with calculated metrics
5. Validate to commit changes

**Key Interactions:**
- Live running totals as items are added
- Auto-generation of output lines from inputs
- "Apply to All" for common dimension changes
- Clear review step before validation

### Inventory View Flow

Simple table view with filtering and sorting.
- Grouped by product type with totals
- Search/filter by product name
- Sort by any column

### Production History Flow

List of all completed processes with drill-down.
- Filter by date range or process type
- Click any row to view full details
- Edit and re-validate if corrections needed

### Dashboard Flow

Overview metrics as the landing page.
- Inventory summary (total, raw, work-in-progress)
- Per-process outcome/waste percentages
- Total outcome/waste percentages
- Click metrics to drill down to details

### Navigation Pattern

Simple top-level navigation between 4 screens:

```
[Dashboard] [Inventory] [Production] [History]
```

## Component Strategy

### Design System Components (shadcn/ui)

| Component | Usage |
|-----------|-------|
| Table | Inventory, History, Production line items |
| Card | Dashboard metrics |
| Button | All actions |
| Input | Text and number entry |
| Select | Dropdowns and filters |
| Dialog | Validation confirmation |
| Form | Production entry wrapper |

### Custom Components

**ProductLineItem**
- Row component for inventory selection in production entry
- Includes: product dropdown, quantity, dimensions, auto-calculated m³, delete
- Used in both Input and Output sections

**ProductionSummary**
- Displays calculated totals: input m³, output m³, outcome %, waste %
- Shown in review step before validation

**ProcessSelector**
- Process type dropdown with standard options
- Includes "Add Custom Process" option at bottom

**MetricCard**
- Dashboard card showing outcome/waste percentages per process
- Visual indicators for performance

### Implementation Priority

**Phase 1 (Core MVP):**
1. ProductLineItem - required for production entry
2. ProductionSummary - required for validation flow
3. ProcessSelector - required for production entry

**Phase 2 (Polish):**
4. MetricCard - enhanced dashboard display

## UX Consistency Patterns

### Button Hierarchy

| Type | Usage | Style |
|------|-------|-------|
| Primary | Main action per screen | Solid, prominent |
| Secondary | Supporting actions | Outline/ghost |
| Destructive | Delete, Remove | Red/warning |
| Ghost | Inline actions | Text only |

Rule: One primary button per screen.

### Feedback Patterns

- **Success:** Toast notification, auto-dismiss 3s
- **Error:** Toast notification, manual dismiss
- **Validation error:** Inline below field + summary at top
- **Confirmation:** Dialog with clear Yes/No

### Form Patterns

- "+ Add Item" button for adding line items
- Validate on blur, show error immediately
- Required fields marked with *
- Running totals update instantly

### Table Patterns

- Sortable columns (click header)
- Filter/search bar above
- Row hover highlights
- Summary row for totals (bold)

### Data Display Conventions

- Dates: European format DD.MM.YYYY (e.g., 24.01.2026)
- Date+time: DD.MM.YYYY HH:mm (e.g., 24.01.2026 14:30)
- Volumes: 3 decimal places with comma separator (e.g., 1,234)
- Percentages: 1 decimal place with % suffix (e.g., 85.3%)

### Empty & Loading States

- Loading: Skeleton rows
- Empty: Friendly message + action link
- No results: Clear message + clear filters button

## Responsive Design & Accessibility

### Responsive Strategy

**MVP: Desktop Only**
- Minimum supported width: 1024px
- No tablet/mobile layouts for MVP
- Future enhancement: Add responsive layouts when needed

### Accessibility Strategy

**Target: WCAG 2.1 Level AA**

| Requirement | Implementation |
|-------------|----------------|
| Color Contrast | 4.5:1 minimum (shadcn/ui default) |
| Keyboard Navigation | Tab, Enter, Escape for all actions |
| Focus Indicators | Visible focus ring on all elements |
| Screen Readers | ARIA labels on custom components |
| Form Labels | All inputs labeled |

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Add input line | Ctrl + I |
| Add output line | Ctrl + O |
| Validate | Ctrl + Enter |
| Cancel | Escape |

### Testing Checklist

- Tab through all flows
- Verify focus visibility
- Test with screen reader
- Check color contrast
- Verify error announcements
