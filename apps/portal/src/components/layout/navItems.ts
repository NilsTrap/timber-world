/**
 * Portal nav config + module-gating filter (pure — no server imports, so it is
 * unit-testable). SidebarWrapper (a server component) imports these and supplies
 * the session/module set at request time.
 *
 * E9: the main nav lists only new/reworked areas; superseded-but-still-used
 * "legacy" sections are grouped under ONE collapsible "Legacy" item (same
 * mechanism as the "UK Agent app" group). Nothing is removed — only regrouped.
 */
import type { NavItem, NavChild } from "./Sidebar";

/**
 * Sub-nav child with an optional module requirement (collapsible-section
 * children carry their own gating so each can be hidden independently).
 */
export interface ModuleNavChild extends NavChild {
  /** Module code required to show this child (null/undefined = always show) */
  requiresModule?: string | null;
  /** Show when the user has ANY of these modules (OR). Takes precedence over requiresModule. */
  requiresAnyModule?: string[];
  /**
   * Module code matched EXACTLY (no sibling prefix matching). Needed where
   * sibling module codes share a prefix but must gate independently — the
   * walled address books (counterparties.clients vs .suppliers). Takes
   * precedence over the other two.
   */
  requiresExactModule?: string;
}

/** Extended NavItem with optional module requirement */
export interface ModuleNavItem extends NavItem {
  /** Module code required to show this nav item (null = always show) */
  requiresModule?: string | null;
  /** Show when the user has ANY of these modules (OR). Takes precedence over requiresModule. */
  requiresAnyModule?: string[];
  /** Children that may each carry their own module gate (collapsible sections). */
  children?: ModuleNavChild[];
}

/**
 * Modules whose access implies the "UK Agent app" section should appear.
 * (Catalogue was promoted OUT of this group to a top-level item — it's a
 * universal catalog, not agent-only — so catalogue.view no longer belongs here.)
 */
export const AGENT_APP_MODULES = ["agents.view", "agent-orders.view", "agent-manual.view"];

/** Children of the "UK Agent app" collapsible section (admin = no gating). */
export const AGENT_APP_CHILDREN: ModuleNavChild[] = [
  { href: "/admin/agents", label: "Agents", iconName: "Contact", requiresModule: "agents.view" },
  { href: "/admin/agent-orders", label: "Agent Orders", iconName: "ClipboardList", requiresModule: "agent-orders.view" },
  { href: "/admin/agent-manual", label: "Agent Manual", iconName: "BookOpen", requiresModule: "agent-manual.view" },
];

/**
 * E9 · Legacy nav group. Old sections that are superseded by the new
 * deal/spine/catalog model but still linger (kept reachable, not deleted) are
 * grouped under ONE collapsible "Legacy" item so the main nav shows only the
 * new/reworked areas. Modules whose access implies the "Legacy" section appears.
 */
export const LEGACY_MODULES = [
  "inventory.view", "production.view", "marketing.view",
  "competitor-pricing.view", "quotes.view", "uk-staircase-pricing.view",
  // CRM (the old contacts CRM — superseded by Counterparties) and Shipments were
  // demoted here: the new deal/spine model owns those relationships + logistics.
  "crm.view", "shipments.view",
];

/** Children of the "Legacy" collapsible section — ADMIN hrefs (admin = no gating). */
export const LEGACY_ADMIN_CHILDREN: ModuleNavChild[] = [
  { href: "/admin/crm", label: "CRM (old)", iconName: "Users" },
  { href: "/admin/shipments", label: "Shipments", iconName: "Truck" },
  { href: "/admin/inventory", label: "Inventory", iconName: "Package" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/admin/marketing", label: "CMS", iconName: "Image" },
  { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp" },
  { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText" },
  { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling" },
  // Per-company access moved into the canonical Companies detail page.
  { href: "/admin/reference", label: "Reference Data", iconName: "FileText" },
];

/** Children of the "Legacy" collapsible section — ORG-USER hrefs + per-child module gates. */
export const LEGACY_ORG_CHILDREN: ModuleNavChild[] = [
  { href: "/admin/crm", label: "CRM (old)", iconName: "Users", requiresModule: "crm.view" },
  { href: "/shipments", label: "Shipments", iconName: "Truck", requiresModule: "shipments.view" },
  { href: "/inventory", label: "Inventory", iconName: "Package", requiresModule: "inventory.view" },
  { href: "/production", label: "Production", iconName: "Factory", requiresModule: "production.view" },
  { href: "/admin/marketing", label: "CMS", iconName: "Image", requiresModule: "marketing.view" },
  { href: "/admin/competitor-pricing", label: "Competitor Pricing", iconName: "TrendingUp", requiresModule: "competitor-pricing.view" },
  { href: "/admin/quotes", label: "Quote Requests", iconName: "FileText", requiresModule: "quotes.view" },
  { href: "/admin/uk-staircase-pricing", label: "UK Staircase Pricing", iconName: "PoundSterling", requiresModule: "uk-staircase-pricing.view" },
];

/**
 * Navigation items for Admin users. Admins see all items — module gating is for
 * org-level access. Main nav = new/reworked areas; the "Legacy" group holds the
 * superseded-but-lingering sections.
 */
export const ADMIN_NAV_ITEMS: ModuleNavItem[] = [
  { href: "/orders", label: "Orders", iconName: "ShoppingCart", group: "orders" },
  { href: "/admin/catalog", label: "Catalogue", iconName: "Layers", group: "catalog", children: [
    { href: "/admin/catalog/products", label: "Products" },
    { href: "/admin/catalog/categories", label: "Categories" },
  ]},
  // One Companies module over the single organisations entity. Platform-only
  // administration (all companies + people) sits beside the walled role books.
  { href: "/counterparties", label: "Companies", iconName: "Handshake", group: "deals", children: [
    { href: "/admin/organisations", label: "All companies" },
    { href: "/counterparties/clients", label: "Customers" },
    { href: "/counterparties/suppliers", label: "Suppliers" },
    { href: "/counterparties/traders", label: "Traders" },
    { href: "/admin/organisations?tab=people", label: "People" },
  ]},
  { href: "agent-app", label: "UK Agent app", iconName: "Store", group: "agent", collapsible: true,
    children: AGENT_APP_CHILDREN },
  { href: "/admin/settings", label: "Settings", iconName: "Settings", group: "settings", children: [
    { href: "/admin/settings/project-stages", label: "Project Stages" },
    { href: "/admin/settings/fields", label: "Fields" },
    { href: "/admin/settings/gates", label: "Deal Gates" },
    { href: "/admin/settings/groups", label: "Access Groups" },
    { href: "/admin/settings/file-cleanup", label: "File Cleanup" },
    { href: "/admin/settings/document-templates", label: "Document Templates" },
    { href: "/admin/settings/packaging", label: "Packaging" },
    { href: "/admin/settings/pricing-units", label: "Pricing Units" },
    { href: "/admin/settings/currencies", label: "Currencies" },
    // Q5.2 · admin-only platform action audit log.
    { href: "/admin/settings/audit", label: "Audit" },
  ]},
  { href: "legacy", label: "Legacy", iconName: "History", collapsible: true, children: LEGACY_ADMIN_CHILDREN },
];

/**
 * Navigation items for Organization Users. Module requirements determine which
 * items are visible per organization.
 */
export function getOrgUserNavItems(pendingShipmentCount: number = 0): ModuleNavItem[] {
  return [
    { href: "/orders", label: "Orders", iconName: "ShoppingCart", requiresModule: "orders.view", group: "orders" },
    { href: "/admin/catalog", label: "Catalogue", iconName: "Layers", requiresModule: "catalogue.view", group: "catalog", children: [
      { href: "/admin/catalog/products", label: "Products" },
      { href: "/admin/catalog/categories", label: "Categories" },
    ]},
    // Organisation-backed customer/supplier company profiles.
    { href: "/counterparties", label: "Companies", iconName: "Handshake", group: "deals",
      requiresAnyModule: ["counterparties.clients", "counterparties.suppliers"], children: [
      { href: "/counterparties/clients", label: "Clients", requiresExactModule: "counterparties.clients" },
      { href: "/counterparties/suppliers", label: "Suppliers", requiresExactModule: "counterparties.suppliers" },
    ]},
    { href: "agent-app", label: "UK Agent app", iconName: "Store", group: "agent", collapsible: true,
      requiresAnyModule: AGENT_APP_MODULES, children: AGENT_APP_CHILDREN },
    { href: "/admin/settings", label: "Settings", iconName: "Settings", requiresAnyModule: ["settings.view", "catalogue.view"], group: "settings", children: [
      { href: "/admin/settings/fields", label: "Fields" },
      { href: "/admin/settings/packaging", label: "Packaging" },
      { href: "/admin/settings/pricing-units", label: "Pricing Units" },
      { href: "/admin/settings/currencies", label: "Currencies" },
    ]},
    { href: "legacy", label: "Legacy", iconName: "History", collapsible: true,
      requiresAnyModule: LEGACY_MODULES, children: LEGACY_ORG_CHILDREN },
  ];
}

/**
 * Timber Projects nav entry (staging-gated).
 *
 * Deliberately NOT part of ADMIN_NAV_ITEMS / getOrgUserNavItems: those two are
 * the static nav contract (navItems.test.ts asserts the admin destination set
 * EXACTLY, so nothing may silently appear there), and Projects must only exist
 * where TIMBER_PROJECTS_ENABLED is on. SidebarWrapper injects it at request
 * time via withProjectsNav().
 */
export const PROJECTS_NAV_ITEM: ModuleNavItem = {
  href: "/projects",
  label: "Projects",
  iconName: "Boxes",
  group: "deals",
};

/**
 * Insert Projects as the first navigation item. Pure: the caller decides `enabled` — it must combine the env
 * flag with the SAME access rule the route enforces (platform admin, or an
 * exact `projects.view`), so the nav can never advertise a page that 404s.
 * Returns the input untouched when disabled; never mutates the input array.
 */
export function withProjectsNav(items: NavItem[], enabled: boolean): NavItem[] {
  if (!enabled) return items;
  if (items.some((item) => item.href === PROJECTS_NAV_ITEM.href)) return items;
  const out = [...items];
  out.unshift(PROJECTS_NAV_ITEM);
  return out;
}

/**
 * Whether a nav item is shown given the enabled-module set:
 * - no requirement → shown; exact-module match; OR any module with the same
 *   prefix (e.g. "orders.view" is implied by any "orders.*").
 */
export function moduleMatches(required: string, enabledModules: Set<string>): boolean {
  if (enabledModules.has(required)) return true;
  const prefix = required.split(".")[0] + ".";
  for (const mod of enabledModules) {
    if (mod.startsWith(prefix)) return true;
  }
  return false;
}

/** Whether a single nav item/child is visible given its module requirement(s). */
export function isVisible(
  req: { requiresModule?: string | null; requiresAnyModule?: string[]; requiresExactModule?: string },
  enabledModules: Set<string>
): boolean {
  if (req.requiresExactModule) return enabledModules.has(req.requiresExactModule);
  if (req.requiresAnyModule?.length) return req.requiresAnyModule.some((m) => moduleMatches(m, enabledModules));
  if (!req.requiresModule) return true;
  return moduleMatches(req.requiresModule, enabledModules);
}

export function filterNavItemsByModules(
  items: ModuleNavItem[],
  enabledModules: Set<string>
): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    // Sections with children: filter children individually; hide the whole
    // section when the user can reach none of them.
    if (item.children) {
      if (!item.collapsible && !isVisible(item, enabledModules)) continue;
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
 * The key (item.href) of the nav SECTION — an item with second-level children —
 * that the given pathname currently belongs to: a regular parent whose route the
 * path is under (e.g. /admin/settings), or a collapsible group one of whose
 * children the path is under (e.g. /admin/agents → "agent-app"). null = none.
 *
 * Drives the SINGLE-OPEN ACCORDION: the section matching the current route is the
 * one auto-expanded; the Sidebar keeps at most one section open at a time, so
 * opening/navigating into one collapses the others — consistently for BOTH the
 * collapsible groups and the route-driven regular parents. Pure/unit-tested.
 */
export function activeSectionKey(items: NavItem[], pathname: string): string | null {
  const under = (href: string) => pathname === href || pathname.startsWith(href + "/");
  for (const it of items) {
    if (!it.children || it.children.length === 0) continue;
    if (it.href.startsWith("/") && under(it.href)) return it.href; // regular parent route
    if (it.children.some((c) => under(c.href))) return it.href; // collapsible group child
  }
  return null;
}
