import {
  getSession,
  isSuperAdmin,
  hasMultipleOrganizations,
  getUserEnabledModules,
  type UserRole,
} from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import type { OrganizationOption } from "./OrganizationSelector";
import type { OrganizationSwitcherOption } from "./OrganizationSwitcher";

/**
 * Extended NavItem with optional module requirement
 */
interface ModuleNavItem extends NavItem {
  /** Module code required to show this nav item (null = always show) */
  requiresModule?: string | null;
}

/**
 * Navigation items for Admin users
 * Admin users see all items - feature filtering is for org-level access
 */
const ADMIN_NAV_ITEMS: ModuleNavItem[] = [
  { href: "/admin/marketing", label: "CMS", iconName: "Image" },
  { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp" },
  { href: "/admin/crm", label: "CRM", iconName: "Users" },
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/orders", label: "Orders", iconName: "ShoppingCart" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText" },
  { href: "/admin/shipments", label: "Shipments", iconName: "Truck" },
  { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling" },
  { href: "/admin/organisations", label: "Users", iconName: "Users2" },
];

/**
 * Navigation items for Organization Users
 * Module requirements determine which items are visible per organization
 */
function getOrgUserNavItems(pendingShipmentCount: number = 0): ModuleNavItem[] {
  return [
    { href: "/admin/marketing", label: "CMS", iconName: "Image", requiresModule: "marketing.view" },
    { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp", requiresModule: "competitor-pricing.view" },
    { href: "/admin/crm", label: "CRM", iconName: "Users", requiresModule: "crm.view" },
    { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", requiresModule: "dashboard.view" },
    { href: "/inventory", label: "Inventory", iconName: "Package", requiresModule: "inventory.view" },
    { href: "/orders", label: "Orders", iconName: "ShoppingCart", requiresModule: "orders.view" },
    { href: "/production", label: "Production", iconName: "Factory", requiresModule: "production.view" },
    { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText", requiresModule: "quotes.view" },
    { href: "/shipments", label: "Shipments", iconName: "Truck", badge: pendingShipmentCount, requiresModule: "shipments.view" },
    { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling", requiresModule: "uk-staircase-pricing.view" },
    { href: "/admin/organisations", label: "Users", iconName: "Users2", requiresModule: "organizations.view" },
  ];
}

/**
 * Filter nav items based on enabled modules.
 *
 * A nav item is shown if:
 * - It has no module requirement, OR
 * - The exact module (e.g. "orders.view") is in the set, OR
 * - Any module with the same prefix (e.g. "orders.create") is in the set
 *   (so that sub-module access implies sidebar visibility)
 */
function filterNavItemsByModules(
  items: ModuleNavItem[],
  enabledModules: Set<string>
): NavItem[] {
  return items.filter((item) => {
    // No module requirement = always show
    if (!item.requiresModule) return true;
    // Exact match
    if (enabledModules.has(item.requiresModule)) return true;
    // Prefix match: "orders.view" → check for any "orders.*" module
    const prefix = item.requiresModule.split(".")[0] + ".";
    for (const mod of enabledModules) {
      if (mod.startsWith(prefix)) return true;
    }
    return false;
  });
}

/**
 * Sidebar Wrapper (Server Component)
 *
 * Fetches session and passes role-appropriate nav items to the client Sidebar.
 * For Super Admin, also fetches organizations for the org selector.
 * For multi-org users, provides organization switcher data.
 * Filters org user nav items based on organization module configuration.
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Super Admin (null org) → "Timber World Platform"
  // Organisation User → their org name
  // Fallback (legacy/unlinked) → "Timber World Platform"
  const brandName = session?.currentOrganizationName || session?.organisationName || "Timber World Platform";

  // Get nav items based on role
  // Pending shipment count is loaded client-side to avoid blocking server render
  let navItems: NavItem[];

  if (session?.role === "admin") {
    // Admin users see all items
    navItems = ADMIN_NAV_ITEMS;
  } else {
    // Org users - filter by user's effective modules (intersection of org + user modules)
    const orgUserItems = getOrgUserNavItems(0);
    const orgId = session?.currentOrganizationId || session?.organisationId || null;
    const portalUserId = session?.portalUserId;
    const enabledModules = portalUserId
      ? await getUserEnabledModules(portalUserId, orgId)
      : new Set<string>();
    navItems = filterNavItemsByModules(orgUserItems, enabledModules);
  }

  // Fetch organizations for Super Admin org selector
  let organizations: OrganizationOption[] | undefined;
  if (isSuperAdmin(session)) {
    const result = await getActiveOrganisations();
    if (result.success) {
      organizations = result.data;
    }
  }

  // Prepare multi-org switcher data (Story 10.7)
  let currentOrganization: OrganizationSwitcherOption | null = null;
  let userMemberships: OrganizationSwitcherOption[] = [];

  if (session && session.memberships.length > 0) {
    // Convert memberships to switcher format
    userMemberships = session.memberships.map((m) => ({
      id: m.organizationId,
      code: m.organizationCode,
      name: m.organizationName,
      isPrimary: m.isPrimary,
    }));

    // Find current organization
    if (session.currentOrganizationId) {
      const current = userMemberships.find(
        (m) => m.id === session.currentOrganizationId
      );
      if (current) {
        currentOrganization = current;
      }
    }
  }

  return (
    <Sidebar
      navItems={navItems}
      brandName={brandName}
      organizations={organizations}
      currentOrganization={currentOrganization}
      userMemberships={userMemberships}
      hasMultipleOrgs={hasMultipleOrganizations(session)}
      loadShipmentBadge={session?.role === "user"}
    />
  );
}
