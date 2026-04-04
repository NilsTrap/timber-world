import {
  getSession,
  isSuperAdmin,
  hasMultipleOrganizations,
  getOrgEnabledModules,
  type UserRole,
} from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import { getPendingShipmentCount } from "@/features/shipments/actions/getOrgShipments";
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
 * Filter nav items based on enabled modules
 */
function filterNavItemsByModules(
  items: ModuleNavItem[],
  enabledModules: Set<string>
): NavItem[] {
  return items.filter((item) => {
    // No module requirement = always show
    if (!item.requiresModule) return true;
    // Check if module is enabled
    return enabledModules.has(item.requiresModule);
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

  // Fetch pending shipment count for org users
  let pendingShipmentCount = 0;
  if (session?.role === "user" && (session.currentOrganizationId || session.organisationId)) {
    const countResult = await getPendingShipmentCount();
    if (countResult.success) {
      pendingShipmentCount = countResult.data;
    }
  }

  // Get nav items based on role
  let navItems: NavItem[];

  if (session?.role === "admin") {
    // Admin users see all items
    navItems = ADMIN_NAV_ITEMS;
  } else {
    // Org users - filter by organization modules
    const orgUserItems = getOrgUserNavItems(pendingShipmentCount);
    const orgId = session?.currentOrganizationId || session?.organisationId || null;
    const enabledModules = await getOrgEnabledModules(orgId);
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
    />
  );
}
