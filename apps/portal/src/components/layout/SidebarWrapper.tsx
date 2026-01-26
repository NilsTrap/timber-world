import { getSession, isSuperAdmin, type UserRole } from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import { getPendingShipmentCount } from "@/features/shipments/actions/getOrgShipments";
import type { OrganizationOption } from "./OrganizationSelector";

/**
 * Navigation items for Admin users
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/admin/shipments", label: "Shipments", iconName: "Truck" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/reference", label: "Reference Data", iconName: "Settings" },
  { href: "/admin/organisations", label: "Organisations", iconName: "Building2" },
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
 */
export async function SidebarWrapper() {
  const session = await getSession();

  // Super Admin (null org) → "Timber World Platform"
  // Organisation User → their org name
  // Fallback (legacy/unlinked) → "Timber World Platform"
  const brandName = session?.organisationName || "Timber World Platform";

  // Fetch pending shipment count for producer users
  let pendingShipmentCount = 0;
  if (session?.role === "producer" && session.organisationId) {
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

  return <Sidebar navItems={navItems} brandName={brandName} organizations={organizations} />;
}
