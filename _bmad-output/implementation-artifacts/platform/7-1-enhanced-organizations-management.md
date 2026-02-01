# Story 7.1: Enhanced Organizations Management

Status: complete

## Story

As a Super Admin,
I want to manage organizations with user count visibility,
So that I can see which organizations have users and which don't.

## Acceptance Criteria

### AC1: Organizations Table with User Count
**Given** I am logged in as Super Admin
**When** I navigate to Admin > Organisations
**Then** I see a table with columns: Code, Name, User Count, Status, Actions

### AC2: Zero Users is Valid State
**Given** I am viewing the organisations table
**When** an organization has 0 users
**Then** the User Count shows "0" (not an error state)
**And** I can still create shipments to/from this organization

### AC3: Organization Detail with Users Tab
**Given** I click on an organization row
**When** the detail view opens
**Then** I see a "Users" tab alongside organization details

### AC4: Access Control
**Given** I am an organization user (not Super Admin)
**When** I try to access Admin > Organisations
**Then** I am redirected with "Access denied" message

## Tasks / Subtasks

- [x] Task 1: Add user count to organizations query (AC: 1, 2)
  - [x] Create `getOrganisationsWithUserCount` action or update existing
  - [x] Join with portal_users to count users per org
  - [x] Return userCount field in organisation data

- [x] Task 2: Update OrganisationsTable component (AC: 1)
  - [x] Add "User Count" column to table
  - [x] Display count (show "0" for orgs with no users)
  - [x] Make row clickable to open detail view

- [x] Task 3: Create Organization Detail Page (AC: 3)
  - [x] Create `/admin/organisations/[id]` route
  - [x] Add tabs: "Details" and "Users"
  - [x] Details tab shows org info (code, name, status)
  - [x] Users tab placeholder (implemented in Story 7.2)

- [x] Task 4: Verify access control (AC: 4)
  - [x] Existing isAdmin check already in place
  - [x] Verify org users are redirected correctly

- [x] Task 5: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Super Admin sees user count column
  - [x] Orgs with 0 users display correctly
  - [x] Clicking org opens detail view

## Dev Notes

### Current Implementation

The OrganisationsTable already exists at:
- `apps/portal/src/features/organisations/components/OrganisationsTable.tsx`
- Uses `getOrganisations` action

Changes needed:
1. Update query to include user count (aggregate from portal_users)
2. Add User Count column to table
3. Create detail page with tabs

### Database Query

```sql
SELECT
  o.id, o.code, o.name, o.is_active,
  COUNT(pu.id) as user_count
FROM organisations o
LEFT JOIN portal_users pu ON pu.organisation_id = o.id
GROUP BY o.id
ORDER BY o.code;
```

### Component Structure

```
/admin/organisations/
├── page.tsx (list view - existing)
└── [id]/
    └── page.tsx (detail view with tabs)
        ├── OrganisationDetails component
        └── OrganisationUsers component (Story 7.2)
```

### Files to Create/Modify

**New Files:**
- `apps/portal/src/app/(portal)/admin/organisations/[id]/page.tsx`
- `apps/portal/src/features/organisations/components/OrganisationDetailTabs.tsx`

**Modified Files:**
- `apps/portal/src/features/organisations/actions/getOrganisations.ts`
- `apps/portal/src/features/organisations/components/OrganisationsTable.tsx`
- `apps/portal/src/features/organisations/types.ts`

### References

- [Source: epics.md#Story-7.1-Enhanced-Organizations-Management]
- [Epic 6: Multi-Tenancy Foundation] (dependency)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - User count query**: Updated `getOrganisations` action to use Supabase's relation counting feature with `portal_users(count)` in the select statement. This efficiently counts users per organisation via the LEFT JOIN relationship.

2. **Task 2 - OrganisationsTable update**:
   - Added "Users" column with icon header
   - Made rows clickable with `router.push()` navigation to detail page
   - Added `stopPropagation()` on action buttons to prevent row click when clicking edit/toggle/delete
   - Added sorting capability for userCount column

3. **Task 3 - Organisation Detail Page**:
   - Created new dynamic route at `/admin/organisations/[id]`
   - Created `OrganisationDetailTabs` component with Details and Users tabs
   - Details tab shows code, name, status, and timestamps
   - Users tab shows placeholder with user count (full implementation in Story 7.2)
   - Added `getOrganisationById` action for fetching single organisation

4. **Task 4 - Access Control**: Verified existing `isAdmin()` check in page component and actions. Non-admin users are redirected to `/dashboard?access_denied=true`.

5. **Task 5 - Build verification**: Build passes successfully with `pnpm turbo build --filter=@timber/portal`.

### Change Log

- 2026-01-25: Story 7.1 created and ready for development
- 2026-01-25: Story 7.1 implemented and completed

### File List

- apps/portal/src/app/(portal)/admin/organisations/[id]/page.tsx (created)
- apps/portal/src/features/organisations/components/OrganisationDetailTabs.tsx (created)
- apps/portal/src/features/organisations/actions/getOrganisationById.ts (created)
- apps/portal/src/features/organisations/actions/getOrganisations.ts (modified)
- apps/portal/src/features/organisations/actions/index.ts (modified)
- apps/portal/src/features/organisations/components/OrganisationsTable.tsx (modified)
- apps/portal/src/features/organisations/types.ts (modified)
- apps/portal/src/features/organisations/index.ts (modified)
