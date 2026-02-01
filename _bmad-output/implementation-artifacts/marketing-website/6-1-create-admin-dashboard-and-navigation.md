# Story 6.1: Create Admin Dashboard and Navigation

Status: ready-for-dev

## Story

As a **Content Manager**,
I want **an admin dashboard with clear navigation**,
so that **I can easily access content management features**.

## Acceptance Criteria

1. **Given** an authenticated admin user
   **When** they access /admin
   **Then** a dashboard displays with overview metrics (product count, pending quotes, recent uploads)

2. **Given** the admin dashboard is displayed
   **When** the user views the sidebar navigation
   **Then** it shows: Dashboard, Products, Quotes, Analytics

3. **Given** the admin layout
   **When** rendered
   **Then** it is distinct from the public site (different header/styling)

4. **Given** an authenticated admin
   **When** viewing the header
   **Then** the current user's name and logout option are visible

5. **Given** any admin page
   **When** rendered
   **Then** breadcrumb navigation shows current location

6. **Given** the dashboard
   **When** viewed on tablet (768px-1024px)
   **Then** the layout is responsive and usable

## Tasks / Subtasks

- [ ] Task 1: Create Admin Layout Structure (AC: 3, 4)
  - [ ] 1.1: Create `src/app/admin/layout.tsx` with auth check
  - [ ] 1.2: Implement AdminSidebar component with navigation links
  - [ ] 1.3: Create admin-specific header with user info and logout
  - [ ] 1.4: Add breadcrumb component for navigation context

- [ ] Task 2: Build Dashboard Page (AC: 1)
  - [ ] 2.1: Create `src/app/admin/page.tsx` as Server Component
  - [ ] 2.2: Implement MetricCard component for overview stats
  - [ ] 2.3: Fetch and display product count from Supabase
  - [ ] 2.4: Fetch and display pending quote count
  - [ ] 2.5: Display recent upload activity (placeholder if no uploads yet)

- [ ] Task 3: Implement Sidebar Navigation (AC: 2)
  - [ ] 3.1: Create AdminSidebar component with collapsible design
  - [ ] 3.2: Add navigation items: Dashboard, Products, Quotes, Analytics
  - [ ] 3.3: Implement active state highlighting for current route
  - [ ] 3.4: Add icons for each navigation item (lucide-react)

- [ ] Task 4: Responsive Design (AC: 6)
  - [ ] 4.1: Implement collapsible sidebar for tablet/mobile
  - [ ] 4.2: Add hamburger menu toggle for mobile
  - [ ] 4.3: Ensure metric cards stack on smaller screens
  - [ ] 4.4: Test touch targets meet 44x44px minimum

## Dev Notes

### Architecture Compliance

**File Structure per Architecture:**
```
src/
├── app/admin/
│   ├── layout.tsx              # Admin layout with auth check
│   ├── page.tsx                # Dashboard page
│   └── login/page.tsx          # (Already exists from Story 1.3)
├── components/
│   ├── layout/
│   │   └── AdminSidebar.tsx    # Sidebar navigation
│   └── features/admin/
│       ├── DashboardMetrics.tsx # Metric cards
│       └── Breadcrumbs.tsx     # Breadcrumb navigation
```

**Authentication Pattern:**
- Admin layout MUST check Supabase Auth session
- Use `lib/supabase/server.ts` for server-side auth check
- Redirect to `/admin/login` if not authenticated

**Component Patterns:**
- Use shadcn/ui components: Card, Button, Avatar, DropdownMenu
- Server Components by default for dashboard
- Client Component only for sidebar toggle state

### Technical Requirements

**Supabase Queries Required:**
```typescript
// Product count
const { count: productCount } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: true })

// Pending quotes count
const { count: pendingQuotes } = await supabase
  .from('quote_requests')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pending')
```

**Navigation Structure:**
```typescript
const adminNavItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Quotes', href: '/admin/quotes', icon: FileText },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
]
```

**Styling Requirements:**
- Admin uses different color scheme from public site
- Background: `bg-slate-50` or similar neutral
- Sidebar: `bg-white` with Forest Green accent for active items
- Cards: `bg-white` with subtle shadow

### Library & Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| @supabase/ssr | Latest | Server-side auth |
| shadcn/ui | Latest | Card, Button, Avatar, DropdownMenu, Skeleton |
| lucide-react | ^0.562.0 | Icons (LayoutDashboard, Package, FileText, BarChart3, LogOut, Menu) |
| next/navigation | Built-in | usePathname for active state |

### Project Structure Notes

**Alignment with Architecture:**
- Admin routes under `/admin/*` per structure spec
- Layout components in `components/layout/`
- Feature components in `components/features/admin/`
- All files use PascalCase naming

**Dependencies on Other Stories:**
- **Story 1.2** (Supabase Schema): Requires `products` and `quote_requests` tables
- **Story 1.3** (Admin Auth): Requires authentication to be working

### Testing Requirements

**Unit Tests:**
- `AdminSidebar.test.tsx`: Navigation renders correctly, active state works
- `DashboardMetrics.test.tsx`: Metrics display with skeleton loading states

**Integration Tests:**
- Auth redirect works when not authenticated
- Dashboard loads and displays metrics

### Security Considerations

- Admin layout MUST verify session before rendering
- All Supabase queries use server client (not browser client)
- No sensitive data exposed in client components
- Session timeout after 24 hours of inactivity (handled by Supabase)

### Accessibility Requirements

- Sidebar navigation keyboard accessible (Tab/Enter)
- Focus states visible on all interactive elements
- Proper heading hierarchy (H1 for page title)
- ARIA labels on icon-only buttons
- Skip link to main content

### References

- [Source: architecture.md#Project-Structure] - Admin route structure
- [Source: architecture.md#Implementation-Patterns] - Naming conventions
- [Source: architecture.md#Authentication-Security] - Supabase Auth pattern
- [Source: epics.md#Story-6.1] - Original acceptance criteria
- [Source: project-context.md] - TypeScript strict mode, shadcn/ui usage

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

