import {
  getSession,
  isSuperAdmin,
  hasMultipleOrganizations,
  type UserRole,
} from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import { getPendingShipmentCount } from "@/features/shipments/actions/getOrgShipments";
import type { OrganizationOption } from "./OrganizationSelector";
import type { OrganizationSwitcherOption } from "./OrganizationSwitcher";

/**
 * Navigation items for Admin users
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/admin/shipments", label: "Shipments", iconName: "Truck" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText" },
  { href: "/admin/analytics", label: "Website Analytics", iconName: "BarChart3" },
  { href: "/admin/reference", label: "Reference Data", iconName: "Settings" },
  { href: "/admin/organisations", label: "Organisations", iconName: "Building2" },
  { href: "/admin/roles", label: "Roles", iconName: "Shield" },
];

/**
 * Navigation items for Producer users (Organization Users)
 * @param pendingShipmentCount - Number of pending incoming shipments for badge
 */
function getProducerNavItems(pendingShipmentCount: number = 0): NavItem[] {
  return [
    { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
    { href: "/inventory", label: "Inventory", iconName: "Package" },
    { href: "/shipments", label: "Shipments", iconName: "Truck", badge: pendingShipmentCount },
    { href: "/production", label: "Production", iconName: "Factory" },
  ];
}

/**
 * Get navigation items based on user role
 */
function getNavItems(role: UserRole, pendingShipmentCount: number = 0): NavItem[] {
  return role === "admin" ? ADMIN_NAV_ITEMS : getProducerNavItems(pendingShipmentCount);
}

/**
 * Sidebar Wrapper (Server Component)
 *
 * Fetches session and passes role-appropriate nav items to the client Sidebar.
 * For Super Admin, also fetches organizations for the org selector.
 * For multi-org users, provides organization switcher data.
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Super Admin (null org) → "Timber World Platform"
  // Organisation User → their org name
  // Fallback (legacy/unlinked) → "Timber World Platform"
  const brandName = session?.currentOrganizationName || session?.organisationName || "Timber World Platform";

  // Fetch pending shipment count for producer users
  let pendingShipmentCount = 0;
  if (session?.role === "producer" && (session.currentOrganizationId || session.organisationId)) {
    const countResult = await getPendingShipmentCount();
    if (countResult.success) {
      pendingShipmentCount = countResult.data;
    }
  }

  const navItems = getNavItems(session?.role || "producer", pendingShipmentCount);

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
