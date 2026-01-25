import { getSession, isSuperAdmin, type UserRole } from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import type { OrganizationOption } from "./OrganizationSelector";

/**
 * Navigation items for Admin users
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/admin/inventory/new-shipment", label: "New Shipment", iconName: "Truck" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/reference", label: "Reference Data", iconName: "Settings" },
  { href: "/admin/organisations", label: "Organisations", iconName: "Building2" },
];

/**
 * Navigation items for Producer users
 */
const PRODUCER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/inventory", label: "Inventory", iconName: "Package" },
  { href: "/production", label: "Production", iconName: "Factory" },
];

/**
 * Get navigation items based on user role
 */
function getNavItems(role: UserRole): NavItem[] {
  return role === "admin" ? ADMIN_NAV_ITEMS : PRODUCER_NAV_ITEMS;
}

/**
 * Sidebar Wrapper (Server Component)
 *
 * Fetches session and passes role-appropriate nav items to the client Sidebar.
 * For Super Admin, also fetches organizations for the org selector.
 */
export async function SidebarWrapper() {
  const session = await getSession();
  const navItems = getNavItems(session?.role || "producer");
  // Super Admin (null org) → "Timber World Platform"
  // Organisation User → their org name
  // Fallback (legacy/unlinked) → "Timber World Platform"
  const brandName = session?.organisationName || "Timber World Platform";

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
