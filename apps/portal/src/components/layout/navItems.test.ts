/**
 * E9 nav-consolidation test (pure): proves the "Legacy" regroup drops NOTHING
 * (every previously-reachable destination is still reachable), keeps the legacy
 * sections OUT of the main nav, and preserves per-module gating.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/components/layout/navItems.test.ts`
 */
import {
  ADMIN_NAV_ITEMS,
  AGENT_APP_CHILDREN,
  getOrgUserNavItems,
  filterNavItemsByModules,
  activeSectionKey,
  LEGACY_ADMIN_CHILDREN,
  PROJECTS_NAV_ITEM,
  withProjectsNav,
  type ModuleNavItem,
} from "./navItems";

let passed = 0, failed = 0;
function ok(label: string, cond: boolean, extra?: unknown) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`, extra !== undefined ? JSON.stringify(extra) : ""); }
}

/** Every real destination href reachable from a nav list (top-level pages + all children). */
function leafHrefs(items: ModuleNavItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it.href.startsWith("/")) out.push(it.href); // a real top-level page
    for (const c of it.children ?? []) out.push(c.href);
  }
  return out;
}
const LEGACY_HREFS = LEGACY_ADMIN_CHILDREN.map((c) => c.href);

// ── 1. Nothing orphaned: the admin nav still reaches EXACTLY the same destinations ──
// (the full pre-E9 destination set — main pages + agent-app + counterparties + settings + the 6 legacy)
const EXPECTED_ADMIN = new Set<string>([
  "/dashboard", "/orders", "/counterparties", "/admin/crm", "/admin/shipments",
  "/admin/settings", "/admin/organisations",
  "/admin/organisations?tab=people",
  "/counterparties/clients", "/counterparties/suppliers",
  "/admin/settings/fields", "/admin/settings/gates", "/admin/settings/groups", "/admin/settings/file-cleanup",
  "/admin/settings/document-templates", "/admin/settings/packaging", "/admin/settings/pricing-units",
  "/admin/settings/currencies",
  // Added after this list was first written: L2 Traders book (admin-only),
  // Q5.2 Audit log and the remaining reference-data manager under Legacy.
  "/counterparties/traders", "/admin/settings/audit",
  "/admin/reference",
  "/admin/agents", "/admin/agent-orders", "/admin/agent-manual",
  // Catalogue is now a section: parent link + Products / Categories children
  "/admin/catalog", "/admin/catalog/products", "/admin/catalog/categories",
  // the 6 legacy destinations — now under the Legacy group, still reachable
  "/admin/inventory", "/production", "/admin/marketing", "/admin/competitor-pricing",
  "/admin/quotes", "/admin/uk-staircase-pricing",
]);
const adminHrefs = leafHrefs(ADMIN_NAV_ITEMS);
const adminSet = new Set(adminHrefs);
ok("admin nav has no duplicate destinations", adminHrefs.length === adminSet.size, adminHrefs);
ok("admin nav reaches EXACTLY the expected destination set (nothing dropped/added)",
   adminSet.size === EXPECTED_ADMIN.size && [...EXPECTED_ADMIN].every((h) => adminSet.has(h)),
   { missing: [...EXPECTED_ADMIN].filter((h) => !adminSet.has(h)), extra: [...adminSet].filter((h) => !EXPECTED_ADMIN.has(h)) });

// ── 2. The Legacy group holds exactly the legacy sections (CRM + Shipments were
//       demoted here from the top level, later Reference Data), and it is collapsible ──
const legacyItem = ADMIN_NAV_ITEMS.find((i) => i.label === "Legacy");
ok("a 'Legacy' collapsible group exists", !!legacyItem && legacyItem.collapsible === true);
ok("Legacy group holds exactly the legacy sections",
   !!legacyItem && (legacyItem.children ?? []).length === LEGACY_ADMIN_CHILDREN.length &&
   (legacyItem.children ?? []).every((c) => LEGACY_HREFS.includes(c.href)));
ok("Legacy group includes the demoted CRM (old) + Shipments",
   (legacyItem?.children ?? []).some((c) => c.href === "/admin/crm") &&
   (legacyItem?.children ?? []).some((c) => c.href === "/admin/shipments"));

// ── 3. The MAIN nav (everything except the Legacy group) contains NO legacy href ──
const mainItems = ADMIN_NAV_ITEMS.filter((i) => i.label !== "Legacy");
const mainHrefs = new Set(leafHrefs(mainItems));
ok("main nav does NOT contain any legacy destination",
   LEGACY_HREFS.every((h) => !mainHrefs.has(h)),
   LEGACY_HREFS.filter((h) => mainHrefs.has(h)));

// ── 4. Org-user gating: a Producer (production + orders) sees Orders + a Legacy group with ONLY Production ──
const producerModules = new Set(["dashboard.view", "orders.view", "production.view"]);
const producerNav = filterNavItemsByModules(getOrgUserNavItems(), producerModules);
const prodLegacy = producerNav.find((i) => i.label === "Legacy");
ok("producer sees Orders in the main nav", producerNav.some((i) => i.href === "/orders"));
ok("producer sees a Legacy group", !!prodLegacy);
ok("producer's Legacy group contains ONLY Production",
   !!prodLegacy && (prodLegacy.children ?? []).length === 1 && prodLegacy.children?.[0]?.href === "/production",
   prodLegacy?.children);
ok("producer does NOT see CMS / competitor-pricing / quotes / staircase",
   !leafHrefs(producerNav as ModuleNavItem[]).some((h) => ["/admin/marketing", "/admin/competitor-pricing", "/admin/quotes", "/admin/uk-staircase-pricing"].includes(h)));
ok("producer without counterparties modules does NOT see Counterparties",
   !producerNav.some((i) => i.href === "/counterparties"));

// ── 5. A role with NO legacy modules → the Legacy group is hidden entirely ──
const salesModules = new Set(["dashboard.view", "orders.view", "counterparties.clients"]);
const salesNav = filterNavItemsByModules(getOrgUserNavItems(), salesModules);
ok("a role with no legacy modules sees NO Legacy group", !salesNav.some((i) => i.label === "Legacy"));
ok("salesperson still sees Counterparties (clients only)",
   salesNav.some((i) => i.href === "/counterparties" && (i.children ?? []).length === 1 && i.children?.[0]?.href === "/counterparties/clients"));

// ── 6. Nav ordering + Catalog promotion (2026-07-02) ────────────────────────
ok("Dashboard is the FIRST nav item", ADMIN_NAV_ITEMS[0]?.href === "/dashboard", ADMIN_NAV_ITEMS[0]?.href);
const catalogItem = ADMIN_NAV_ITEMS.find((i) => i.href === "/admin/catalog");
ok("Catalogue is a top-level section with Products + Categories (Products first)",
   !!catalogItem && !catalogItem.collapsible && (catalogItem.children ?? []).length === 2 &&
   catalogItem.children?.[0]?.href === "/admin/catalog/products" &&
   catalogItem.children?.[1]?.href === "/admin/catalog/categories",
   catalogItem?.children);
ok("Catalogue is NO LONGER a child of the UK Agent app group",
   !AGENT_APP_CHILDREN.some((c) => c.href === "/admin/catalog"));
// still no orphan: catalog remains reachable (asserted by the EXACT-set check above)
ok("Catalogue is still reachable (present in the destination set)", adminSet.has("/admin/catalog"));

// ── 7. Accordion: activeSectionKey resolves the correct open section ─────────
ok("route under a regular parent → that parent's key (settings)",
   activeSectionKey(ADMIN_NAV_ITEMS, "/admin/settings/fields") === "/admin/settings");
ok("route under a collapsible group child → the group key (agent-app)",
   activeSectionKey(ADMIN_NAV_ITEMS, "/admin/agents") === "agent-app");
ok("route under Legacy child → 'legacy'",
   activeSectionKey(ADMIN_NAV_ITEMS, "/production") === "legacy");
ok("counterparties child → '/counterparties'",
   activeSectionKey(ADMIN_NAV_ITEMS, "/counterparties/suppliers") === "/counterparties");
ok("all-companies child → '/counterparties'",
   activeSectionKey(ADMIN_NAV_ITEMS, "/admin/organisations") === "/counterparties");
ok("a leaf route (Dashboard) opens NO section", activeSectionKey(ADMIN_NAV_ITEMS, "/dashboard") === null);
ok("Catalogue opens its OWN section on catalog routes",
   activeSectionKey(ADMIN_NAV_ITEMS, "/admin/catalog") === "/admin/catalog" &&
   activeSectionKey(ADMIN_NAV_ITEMS, "/admin/catalog/products") === "/admin/catalog");
// at most one section can match a given path (single-open is well-defined)
for (const path of ["/admin/settings/fields", "/admin/agents", "/production", "/counterparties/clients", "/dashboard", "/admin/catalog"]) {
  const matches = ADMIN_NAV_ITEMS.filter((i) => activeSectionKey([i], path) !== null).length;
  ok(`exactly ≤1 section matches "${path}" (accordion is single-open)`, matches <= 1, matches);
}

// ── 8. Company profiles nav; old CRM+Shipments remain under Legacy;
//       every primary area carries a colour `group` ──
const crmItem = ADMIN_NAV_ITEMS.find((i) => i.href === "/counterparties");
ok("the counterparties hub is labelled 'Companies'", crmItem?.label === "Companies");
ok("no TOP-LEVEL CRM or Shipments item remains (they moved under Legacy)",
   !ADMIN_NAV_ITEMS.some((i) => i.href === "/admin/crm" || i.href === "/admin/shipments"));
const orgCrm = getOrgUserNavItems().find((i) => i.href === "/counterparties");
ok("org-user counterparties hub is also labelled 'Companies'", orgCrm?.label === "Companies");
ok("org-user nav has no top-level CRM/Shipments",
   !getOrgUserNavItems().some((i) => i.href === "/admin/crm" || i.href === "/shipments"));
for (const [href, group] of [["/dashboard", "dashboard"], ["/orders", "orders"], ["/counterparties", "deals"]] as const) {
  const it = ADMIN_NAV_ITEMS.find((i) => i.href === href);
  ok(`${href} carries a colour group (${group})`, it?.group === group, it?.group);
}
ok("all companies + people are consolidated under Companies",
   crmItem?.children?.some((child) => child.href === "/admin/organisations") === true &&
   crmItem?.children?.some((child) => child.href === "/admin/organisations?tab=people") === true &&
   !ADMIN_NAV_ITEMS.some((item) => item.label === "Orgs & People"));

// ── 9. Timber Projects (staging-gated) is INJECTED, never part of the static nav ──
// The exact-set assertion in §1 is the reason: /projects must not appear in
// ADMIN_NAV_ITEMS. SidebarWrapper adds it at request time behind the env flag
// plus the same access rule the route enforces.
ok("no static nav list contains /projects",
   !leafHrefs(ADMIN_NAV_ITEMS).includes("/projects") &&
   !leafHrefs(getOrgUserNavItems()).includes("/projects"));
ok("withProjectsNav(disabled) changes nothing",
   withProjectsNav(ADMIN_NAV_ITEMS, false) === ADMIN_NAV_ITEMS);
const adminWithProjects = withProjectsNav(ADMIN_NAV_ITEMS, true);
ok("withProjectsNav(enabled) inserts Projects right after Orders",
   adminWithProjects.findIndex((i) => i.href === "/projects") ===
     adminWithProjects.findIndex((i) => i.href === "/orders") + 1);
ok("withProjectsNav(enabled) adds exactly one entry and drops nothing",
   adminWithProjects.length === ADMIN_NAV_ITEMS.length + 1 &&
   leafHrefs(ADMIN_NAV_ITEMS as ModuleNavItem[]).every((h) =>
     leafHrefs(adminWithProjects as ModuleNavItem[]).includes(h)));
ok("withProjectsNav does not mutate the static admin nav",
   !ADMIN_NAV_ITEMS.some((i) => i.href === "/projects"));
ok("withProjectsNav is idempotent",
   withProjectsNav(adminWithProjects, true).filter((i) => i.href === "/projects").length === 1);
ok("the Projects item carries a colour group like every primary area",
   PROJECTS_NAV_ITEM.group === "deals" && PROJECTS_NAV_ITEM.iconName === "Boxes");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
