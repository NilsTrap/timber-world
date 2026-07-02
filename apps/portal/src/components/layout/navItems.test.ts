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
  "/counterparties/clients", "/counterparties/suppliers",
  "/admin/settings/fields", "/admin/settings/gates", "/admin/settings/groups",
  "/admin/settings/document-templates", "/admin/settings/packaging", "/admin/settings/pricing-units",
  "/admin/agents", "/admin/agent-orders", "/admin/agent-manual", "/admin/catalog",
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

// ── 2. The Legacy group holds exactly the 6 legacy sections, and it is collapsible ──
const legacyItem = ADMIN_NAV_ITEMS.find((i) => i.label === "Legacy");
ok("a 'Legacy' collapsible group exists", !!legacyItem && legacyItem.collapsible === true);
ok("Legacy group holds exactly the 6 legacy sections",
   !!legacyItem && (legacyItem.children ?? []).length === 6 &&
   (legacyItem.children ?? []).every((c) => LEGACY_HREFS.includes(c.href)));

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
ok("Catalogue is a TOP-LEVEL main item (not collapsible, no children)",
   !!catalogItem && !catalogItem.collapsible && !catalogItem.children);
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
ok("a leaf route (Dashboard) opens NO section", activeSectionKey(ADMIN_NAV_ITEMS, "/dashboard") === null);
ok("the promoted Catalogue leaf opens NO section", activeSectionKey(ADMIN_NAV_ITEMS, "/admin/catalog") === null);
// at most one section can match a given path (single-open is well-defined)
for (const path of ["/admin/settings/fields", "/admin/agents", "/production", "/counterparties/clients", "/dashboard", "/admin/catalog"]) {
  const matches = ADMIN_NAV_ITEMS.filter((i) => activeSectionKey([i], path) !== null).length;
  ok(`exactly ≤1 section matches "${path}" (accordion is single-open)`, matches <= 1, matches);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
