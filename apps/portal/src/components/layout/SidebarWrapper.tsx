import {
  getSession,
  isSuperAdmin,
  isPlatformAdmin,
  hasMultipleOrganizations,
  getUserEnabledModules,
} from "@/lib/auth";
import { Sidebar, type NavItem } from "./Sidebar";
import {
  ADMIN_NAV_ITEMS,
  getOrgUserNavItems,
  filterNavItemsByModules,
  withProjectsNav,
} from "./navItems";
import { isTimberProjectsEnabled } from "@/features/projects/config";
import { PROJECTS_MODULE } from "@/features/projects/gate";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import type { OrganizationOption } from "./OrganizationSelector";
import type { OrganizationSwitcherOption } from "./OrganizationSwitcher";

/**
 * Sidebar Wrapper (Server Component)
 *
 * Fetches session and passes role-appropriate nav items to the client Sidebar.
 * For Super Admin, also fetches organizations for the org selector.
 * For multi-org users, provides organization switcher data.
 * Filters org user nav items based on organization module configuration.
 * The nav config + module-gating filter live in ./navItems (pure, unit-tested).
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

  const orgId = session?.currentOrganizationId || session?.organisationId || null;
  const portalUserId = session?.portalUserId;
  // Effective modules (org ceiling ∩ user groups). Fetched once and reused by
  // both the nav filter and the Projects gate; getUserEnabledModules is
  // React-cached, so the extra call in the admin branch costs nothing.
  let enabledModules: Set<string> | null = null;

  if (session?.role === "admin") {
    // Admin users see all items
    navItems = ADMIN_NAV_ITEMS;
  } else {
    // Org users - filter by user's effective modules (intersection of org + user modules)
    const orgUserItems = getOrgUserNavItems(0);
    enabledModules = portalUserId
      ? await getUserEnabledModules(portalUserId, orgId)
      : new Set<string>();
    navItems = filterNavItemsByModules(orgUserItems, enabledModules);
  }

  // Timber Projects (staging-gated). The predicate MIRRORS the route gate
  // (features/projects/gate.ts): platform admin by is_platform_admin, or an
  // EXACT `orders.view` in the current org — deliberately not the nav's
  // prefix-matching moduleMatches, which would advertise a link that 404s.
  let projectsVisible = false;
  if (isTimberProjectsEnabled() && session) {
    if (isPlatformAdmin(session)) {
      projectsVisible = true;
    } else if (orgId) {
      const mods =
        enabledModules ??
        (portalUserId ? await getUserEnabledModules(portalUserId, orgId) : new Set<string>());
      projectsVisible = mods.has(PROJECTS_MODULE);
    }
  }
  navItems = withProjectsNav(navItems, projectsVisible);

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
      isAdmin={session?.role === "admin"}
      loadShipmentBadge={session?.role === "user"}
    />
  );
}
