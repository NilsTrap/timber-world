import {
  getSession,
  isSuperAdmin,
  hasMultipleOrganizations,
  getUserEnabledModules,
  type UserRole,
} from "@/lib/auth";
import { Sidebar, type NavItem, type NavChild } from "./Sidebar";
import { getActiveOrganisations } from "@/features/shipments/actions/getActiveOrganisations";
import type { OrganizationOption } from "./OrganizationSelector";
import type { OrganizationSwitcherOption } from "./OrganizationSwitcher";

/**
 * Sub-nav child with an optional module requirement (collapsible-section
 * children carry their own gating so each can be hidden independently).
 */
interface ModuleNavChild extends NavChild {
  /** Module code required to show this child (null/undefined = always show) */
  requiresModule?: string | null;
  /** Show when the user has ANY of these modules (OR). Takes precedence over requiresModule. */
  requiresAnyModule?: string[];
}

/**
 * Extended NavItem with optional module requirement
 */
interface ModuleNavItem extends NavItem {
  /** Module code required to show this nav item (null = always show) */
  requiresModule?: string | null;
  /** Show when the user has ANY of these modules (OR). Takes precedence over requiresModule. */
  requiresAnyModule?: string[];
  /** Children that may each carry their own module gate (collapsible sections). */
  children?: ModuleNavChild[];
}

/** Modules whose access implies the "UK Agent app" section should appear. */
const AGENT_APP_MODULES = ["agents.view", "agent-orders.view", "agent-manual.view", "catalogue.view"];

/** Children of the "UK Agent app" collapsible section (admin = no gating). */
const AGENT_APP_CHILDREN: ModuleNavChild[] = [
  { href: "/admin/agents", label: "Agents", iconName: "Contact", requiresModule: "agents.view" },
  { href: "/admin/agent-orders", label: "Agent Orders", iconName: "ClipboardList", requiresModule: "agent-orders.view" },
  { href: "/admin/agent-manual", label: "Agent Manual", iconName: "BookOpen", requiresModule: "agent-manual.view" },
  { href: "/admin/catalog", label: "Catalogue", iconName: "Layers", requiresModule: "catalogue.view" },
];

/**
 * Navigation items for Admin users
 * Admin users see all items - feature filtering is for org-level access
 */
const ADMIN_NAV_ITEMS: ModuleNavItem[] = [
  { href: "agent-app", label: "UK Agent app", iconName: "Store", group: "agent", collapsible: true,
    children: AGENT_APP_CHILDREN },
  { href: "/admin/marketing", label: "CMS", iconName: "Image" },
  { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp" },
  { href: "/admin/crm", label: "CRM", iconName: "Users" },
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/orders", label: "Orders", iconName: "ShoppingCart" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText" },
  { href: "/admin/settings", label: "Settings", iconName: "Settings", group: "settings", children: [
    { href: "/admin/settings/fields", label: "Fields" },
    { href: "/admin/settings/packaging", label: "Packaging" },
    { href: "/admin/settings/pricing-units", label: "Pricing Units" },
  ]},
  { href: "/admin/shipments", label: "Shipments", iconName: "Truck" },
  { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling" },
  { href: "/admin/organisations", label: "Orgs & People", iconName: "Users2" },
];

/**
 * Navigation items for Organization Users
 * Module requirements determine which items are visible per organization
 */
function getOrgUserNavItems(pendingShipmentCount: number = 0): ModuleNavItem[] {
  return [
    { href: "agent-app", label: "UK Agent app", iconName: "Store", group: "agent", collapsible: true,
      requiresAnyModule: AGENT_APP_MODULES, children: AGENT_APP_CHILDREN },
    { href: "/admin/marketing", label: "CMS", iconName: "Image", requiresModule: "marketing.view" },
    { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp", requiresModule: "competitor-pricing.view" },
    { href: "/admin/crm", label: "CRM", iconName: "Users", requiresModule: "crm.view" },
    { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", requiresModule: "dashboard.view" },
    { href: "/inventory", label: "Inventory", iconName: "Package", requiresModule: "inventory.view" },
    { href: "/orders", label: "Orders", iconName: "ShoppingCart", requiresModule: "orders.view" },
    { href: "/production", label: "Production", iconName: "Factory", requiresModule: "production.view" },
    { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText", requiresModule: "quotes.view" },
    { href: "/admin/settings", label: "Settings", iconName: "Settings", requiresAnyModule: ["settings.view", "catalogue.view"], group: "settings", children: [
      { href: "/admin/settings/fields", label: "Fields" },
      { href: "/admin/settings/packaging", label: "Packaging" },
      { href: "/admin/settings/pricing-units", label: "Pricing Units" },
    ]},
    { href: "/shipments", label: "Shipments", iconName: "Truck", badge: pendingShipmentCount, requiresModule: "shipments.view" },
    { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling", requiresModule: "uk-staircase-pricing.view" },
    { href: "/admin/organisations", label: "Orgs & People", iconName: "Users2", requiresModule: "organizations.view" },
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
function moduleMatches(required: string, enabledModules: Set<string>): boolean {
  // Exact match
  if (enabledModules.has(required)) return true;
  // Prefix match: "orders.view" → any "orders.*" module implies visibility
  const prefix = required.split(".")[0] + ".";
  for (const mod of enabledModules) {
    if (mod.startsWith(prefix)) return true;
  }
  return false;
}

/** Whether a single nav item/child is visible given its module requirement(s). */
function isVisible(
  req: { requiresModule?: string | null; requiresAnyModule?: string[] },
  enabledModules: Set<string>
): boolean {
  // OR requirement: show when the user has ANY of the listed modules
  if (req.requiresAnyModule?.length) {
    return req.requiresAnyModule.some((m) => moduleMatches(m, enabledModules));
  }
  // No module requirement = always show
  if (!req.requiresModule) return true;
  return moduleMatches(req.requiresModule, enabledModules);
}

function filterNavItemsByModules(
  items: ModuleNavItem[],
  enabledModules: Set<string>
): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    // Collapsible sections: filter children individually; hide the whole
    // section when the user can reach none of them.
    if (item.collapsible && item.children) {
      const children = item.children.filter((child) => isVisible(child, enabledModules));
      if (children.length === 0) continue;
      result.push({ ...item, children });
      continue;
    }
    if (isVisible(item, enabledModules)) result.push(item);
  }
  return result;
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
