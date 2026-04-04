import {
  getSession,
  isSuperAdmin,
  hasMultipleOrganizations,
  getOrgEnabledFeatures,
  type UserRole,
} from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import { getPendingShipmentCount } from "@/features/shipments/actions/getOrgShipments";
import type { OrganizationOption } from "./OrganizationSelector";
import type { OrganizationSwitcherOption } from "./OrganizationSwitcher";

/**
 * Extended NavItem with optional feature requirement
 */
interface FeatureNavItem extends NavItem {
  /** Feature code required to show this nav item (null = always show) */
  requiresFeature?: string | null;
}

/**
 * Navigation items for Admin users
 * Admin users see all items - feature filtering is for org-level access
 */
const ADMIN_NAV_ITEMS: FeatureNavItem[] = [
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
 * Navigation items for Producer users (Organization Users)
 * Feature requirements determine which items are visible per organization
 */
function getProducerNavItems(pendingShipmentCount: number = 0): FeatureNavItem[] {
  return [
    { href: "/admin/marketing", label: "CMS", iconName: "Image", requiresFeature: "marketing.view" },
    { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp", requiresFeature: "competitor-pricing.view" },
    { href: "/admin/crm", label: "CRM", iconName: "Users", requiresFeature: "crm.view" },
    { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", requiresFeature: "dashboard.view" },
    { href: "/inventory", label: "Inventory", iconName: "Package", requiresFeature: "inventory.view" },
    { href: "/orders", label: "Orders", iconName: "ShoppingCart", requiresFeature: "orders.view" },
    { href: "/production", label: "Production", iconName: "Factory", requiresFeature: "production.view" },
    { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText", requiresFeature: "quotes.view" },
    { href: "/shipments", label: "Shipments", iconName: "Truck", badge: pendingShipmentCount, requiresFeature: "shipments.view" },
    { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling", requiresFeature: "uk-staircase-pricing.view" },
    { href: "/admin/organisations", label: "Users", iconName: "Users2", requiresFeature: "organizations.view" },
  ];
}

/**
 * Filter nav items based on enabled features
 */
function filterNavItemsByFeatures(
  items: FeatureNavItem[],
  enabledFeatures: Set<string>
): NavItem[] {
  return items.filter((item) => {
    // No feature requirement = always show
    if (!item.requiresFeature) return true;
    // Check if feature is enabled
    return enabledFeatures.has(item.requiresFeature);
  });
}

/**
 * Sidebar Wrapper (Server Component)
 *
 * Fetches session and passes role-appropriate nav items to the client Sidebar.
 * For Super Admin, also fetches organizations for the org selector.
 * For multi-org users, provides organization switcher data.
 * Filters producer nav items based on organization feature configuration.
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Super Admin (null org) → "Timber World Platform"
  // Organisation User → their org name
  // Fallback (legacy/unlinked) → "Timber World Platform"
  const brandName = session?.currentOrganizationName || session?.organisationName || "Timber World Platform";

  // Fetch pending shipment count for producer users
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
    // Producer users - filter by organization features
    const producerItems = getProducerNavItems(pendingShipmentCount);
    const orgId = session?.currentOrganizationId || session?.organisationId || null;
    const enabledFeatures = await getOrgEnabledFeatures(orgId);
    navItems = filterNavItemsByFeatures(producerItems, enabledFeatures);
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
