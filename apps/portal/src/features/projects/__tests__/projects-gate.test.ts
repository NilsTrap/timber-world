/**
 * Timber Projects — access-gate + nav-injection tests (pure, no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/projects/__tests__/projects-gate.test.ts`
 *
 * Proves the fail-closed matrix: the flag beats everything (and denies BEFORE
 * auth, so the redirect cannot be used as an oracle), platform admin is the
 * ONLY admin notion, a non-admin needs a current org AND an exact `projects.view`,
 * and organisation role flags never grant anything.
 */
import { evaluateProjectsGate, PROJECTS_MODULE, type ProjectsGateInput } from "../gate";
import { isTimberProjectsEnabled } from "../config";
import { personasForOrg, type OrgRoleFlags } from "../personas";
import { isPartyOrg } from "../projection";
import {
  PROJECTS_NAV_ITEM,
  withProjectsNav,
  ADMIN_NAV_ITEMS,
  getOrgUserNavItems,
  filterNavItemsByModules,
} from "@/components/layout/navItems";
import type { NavItem } from "@/components/layout/Sidebar";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, cond: boolean, extra?: unknown) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`, extra !== undefined ? JSON.stringify(extra) : ""); }
}

const ORG = "11111111-1111-4111-8111-111111111111";
function gate(over: Partial<ProjectsGateInput> = {}) {
  return evaluateProjectsGate({
    flagEnabled: true,
    authenticated: true,
    isPlatformAdmin: false,
    orgId: ORG,
    modules: new Set<string>([PROJECTS_MODULE]),
    ...over,
  });
}

// ── 1. The flag ──────────────────────────────────────────────────────────────
eq("flag off + unauthenticated → not_found (never a login redirect oracle)",
   gate({ flagEnabled: false, authenticated: false }), { ok: false, deny: "not_found" });
eq("flag off + platform admin → not_found (admins cannot bypass the flag)",
   gate({ flagEnabled: false, isPlatformAdmin: true }), { ok: false, deny: "not_found" });
eq("flag off + projects.view user → not_found",
   gate({ flagEnabled: false }), { ok: false, deny: "not_found" });

// ── 2. Authentication ────────────────────────────────────────────────────────
eq("flag on + unauthenticated → login",
   gate({ authenticated: false }), { ok: false, deny: "login" });
eq("flag on + unauthenticated + no org/modules → login (auth wins over org)",
   gate({ authenticated: false, orgId: null, modules: new Set() }), { ok: false, deny: "login" });

// ── 3. Platform admin ────────────────────────────────────────────────────────
eq("platform admin with no org and no modules → allowed",
   gate({ isPlatformAdmin: true, orgId: null, modules: new Set() }), { ok: true, reason: "admin" });

// ── 4. Non-admin: org + exact module ─────────────────────────────────────────
eq("projects.view in a current org → allowed", gate(), { ok: true, reason: "module" });
eq("projects.view but no current org → not_found",
   gate({ orgId: null }), { ok: false, deny: "not_found" });
eq("no modules at all → not_found",
   gate({ modules: new Set() }), { ok: false, deny: "not_found" });
eq("orders.tab.production only → not_found (exact has(), no prefix leniency)",
   gate({ modules: new Set(["orders.tab.production"]) }), { ok: false, deny: "not_found" });
eq("orders.view.something → not_found (no prefix leniency the other way either)",
   gate({ modules: new Set(["orders.view.something"]) }), { ok: false, deny: "not_found" });
eq("an unrelated module (counterparties.clients) → not_found",
   gate({ modules: new Set(["counterparties.clients"]) }), { ok: false, deny: "not_found" });

// A legacy `role === "admin"` session carries isPlatformAdmin === false; it must
// walk the module path like anybody else.
eq("legacy role-admin (is_platform_admin false) with no modules → not_found",
   gate({ isPlatformAdmin: false, modules: new Set() }), { ok: false, deny: "not_found" });
eq("legacy role-admin WITH projects.view → allowed as a module user, not as admin",
   gate({ isPlatformAdmin: false }), { ok: true, reason: "module" });

// ── 5. Organisation role flags label, they never grant ───────────────────────
// Compose the two halves the way access.ts does — personas from the org's role
// flags, the decision from modules — and show the flags move one and not the
// other. (Not a tautology: personasForOrg really runs, and its output really
// differs between the three cases.)
function viewer(flags: OrgRoleFlags, modules: Set<string>) {
  return {
    personas: personasForOrg(flags),
    decision: evaluateProjectsGate({
      flagEnabled: true, authenticated: true, isPlatformAdmin: false, orgId: ORG, modules,
    }),
  };
}
const withModule = new Set<string>([PROJECTS_MODULE]);
const buyerViewer = viewer({ isCustomer: true }, withModule);
const traderViewer = viewer({ isTrader: true }, withModule);
const supplierViewer = viewer({ isSupplier: true, isManufacturer: true }, withModule);
eq("the three personas really are different",
   [buyerViewer.personas, traderViewer.personas, supplierViewer.personas],
   [["buyer"], ["trader"], ["supplier"]]);
eq("…yet the access decision is identical for all three",
   [buyerViewer.decision, traderViewer.decision, supplierViewer.decision],
   [{ ok: true, reason: "module" }, { ok: true, reason: "module" }, { ok: true, reason: "module" }]);
eq("a supplier-flagged organisation without projects.view is still denied",
   viewer({ isSupplier: true }, new Set()).decision, { ok: false, deny: "not_found" });
eq("a buyer-flagged organisation without projects.view is still denied",
   viewer({ isCustomer: true }, new Set()).decision, { ok: false, deny: "not_found" });
eq("an organisation with NO role flag but WITH projects.view is allowed",
   viewer({}, withModule).decision, { ok: true, reason: "module" });

// ── 5b. The flag reader itself (clause #1 of the contract) ───────────────────
const savedFlag = process.env.TIMBER_PROJECTS_ENABLED;
delete process.env.TIMBER_PROJECTS_ENABLED;
eq("unset env → disabled", isTimberProjectsEnabled(), false);
for (const v of ["", "false", "TRUE", "True", "1", "yes", " true"]) {
  process.env.TIMBER_PROJECTS_ENABLED = v;
  eq(`env "${v}" → disabled (strict === "true")`, isTimberProjectsEnabled(), false);
}
process.env.TIMBER_PROJECTS_ENABLED = "true";
eq('env "true" → enabled', isTimberProjectsEnabled(), true);
if (savedFlag === undefined) delete process.env.TIMBER_PROJECTS_ENABLED;
else process.env.TIMBER_PROJECTS_ENABLED = savedFlag;

// ── 5c. Same-organisation rule for a multi-org viewer ────────────────────────
const dealOf = (seller: string | null, buyer: string | null, producer: string | null = null) =>
  ({ seller: { id: seller, code: null, name: null },
     buyer: { id: buyer, code: null, name: null },
     producer: { id: producer, code: null, name: null } }) as unknown as Parameters<typeof isPartyOrg>[0];
ok("the current org as seller counts as a party", isPartyOrg(dealOf(ORG, "other"), ORG));
ok("the current org as buyer counts as a party", isPartyOrg(dealOf("other", ORG), ORG));
ok("the deprecated producer slot alone does NOT make the current org a party",
   !isPartyOrg(dealOf("other", "other2", ORG), ORG));
ok("a deal of ANOTHER membership is not a party deal here",
   !isPartyOrg(dealOf("other", "other2"), ORG));
ok("no current org → never a party", !isPartyOrg(dealOf(ORG, "other"), null));

// ── 6. Nav injection ─────────────────────────────────────────────────────────
const baseNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/orders", label: "Orders", iconName: "ShoppingCart" },
  { href: "/counterparties", label: "CRM", iconName: "Handshake" },
];

const off = withProjectsNav(baseNav, false);
ok("disabled → the exact same array is returned (zero nav mutation)", off === baseNav);
ok("disabled → no /projects href", !off.some((i) => i.href === "/projects"));

const on = withProjectsNav(baseNav, true);
eq("enabled → Projects lands directly after Orders",
   on.map((i) => i.href), ["/dashboard", "/orders", "/projects", "/counterparties"]);
eq("enabled → exactly one Projects entry",
   on.filter((i) => i.href === "/projects").length, 1);
eq("enabled → the input array is not mutated", baseNav.map((i) => i.href),
   ["/dashboard", "/orders", "/counterparties"]);
eq("idempotent — a second call adds nothing",
   withProjectsNav(on, true).filter((i) => i.href === "/projects").length, 1);
eq("no Orders item → Projects follows Dashboard",
   withProjectsNav([{ href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" }], true)
     .map((i) => i.href), ["/dashboard", "/projects"]);
eq("the injected item carries the shared icon/group contract",
   { icon: PROJECTS_NAV_ITEM.iconName, group: PROJECTS_NAV_ITEM.group, label: PROJECTS_NAV_ITEM.label },
   { icon: "Boxes", group: "deals", label: "Projects" });
ok("the injected item requires no module of its own (the caller gates it)",
   PROJECTS_NAV_ITEM.requiresModule === undefined && PROJECTS_NAV_ITEM.requiresAnyModule === undefined);

// The static admin nav must stay exactly as navItems.test.ts asserts it.
ok("ADMIN_NAV_ITEMS still contains no /projects entry",
   !ADMIN_NAV_ITEMS.some((i) => i.href === "/projects" || (i.children ?? []).some((c) => c.href === "/projects")));

// ── 7. Confirmed Nilitto MVP navigation presets ──────────────────────────
function navFor(modules: string[]) {
  const filtered = filterNavItemsByModules(getOrgUserNavItems(), new Set(modules));
  return withProjectsNav(filtered, modules.includes(PROJECTS_MODULE)).map((item) => ({
    label: item.label,
    children: item.children?.map((child) => child.label) ?? [],
  }));
}

eq("Buyer sees only Dashboard and Projects",
   navFor(["dashboard.view", PROJECTS_MODULE]),
   [{ label: "Dashboard", children: [] }, { label: "Projects", children: [] }]);
eq("Manufacturer/Supplier sees only Dashboard and Projects",
   navFor(["dashboard.view", PROJECTS_MODULE]),
   [{ label: "Dashboard", children: [] }, { label: "Projects", children: [] }]);
eq("Trader sees Dashboard, Projects and both company books",
   navFor(["dashboard.view", PROJECTS_MODULE, "counterparties.clients", "counterparties.suppliers"]),
   [
     { label: "Dashboard", children: [] },
     { label: "Projects", children: [] },
     { label: "Companies", children: ["Clients", "Suppliers"] },
   ]);

console.log(`\nprojects-gate.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
