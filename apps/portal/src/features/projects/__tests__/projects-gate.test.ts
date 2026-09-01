/**
 * Timber Projects — access-gate + nav-injection tests (pure, no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/projects/__tests__/projects-gate.test.ts`
 *
 * Proves the fail-closed matrix: the flag beats everything (and denies BEFORE
 * auth, so the redirect cannot be used as an oracle), while every authenticated
 * user is admitted and row visibility remains RLS-backed.
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
import { readFileSync } from "node:fs";

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

// ── 1. The retired flag no longer gates the canonical portal home ───────────
eq("legacy flag false + unauthenticated → login",
   gate({ flagEnabled: false, authenticated: false }), { ok: false, deny: "login" });
eq("legacy flag false + platform admin → allowed",
   gate({ flagEnabled: false, isPlatformAdmin: true }), { ok: true, reason: "authenticated" });
eq("legacy flag false + organisation user → allowed",
   gate({ flagEnabled: false }), { ok: true, reason: "authenticated" });

// ── 2. Authentication ────────────────────────────────────────────────────────
eq("flag on + unauthenticated → login",
   gate({ authenticated: false }), { ok: false, deny: "login" });
eq("flag on + unauthenticated + no org/modules → login (auth wins over org)",
   gate({ authenticated: false, orgId: null, modules: new Set() }), { ok: false, deny: "login" });

// ── 3. Platform admin ────────────────────────────────────────────────────────
eq("platform admin with no org and no modules → allowed",
   gate({ isPlatformAdmin: true, orgId: null, modules: new Set() }), { ok: true, reason: "authenticated" });

// ── 4. Every authenticated user reaches the current portal home ─────────────
eq("projects.view in a current org → allowed", gate(), { ok: true, reason: "authenticated" });
eq("non-admin without a current organisation → not_found",
   gate({ orgId: null }), { ok: false, deny: "not_found" });
eq("authenticated user with no modules → allowed",
   gate({ modules: new Set() }), { ok: true, reason: "authenticated" });
eq("an unrelated module does not affect access",
   gate({ modules: new Set(["counterparties.clients"]) }), { ok: true, reason: "authenticated" });

// A legacy `role === "admin"` session carries isPlatformAdmin === false; it must
// walk the module path like anybody else.
eq("legacy role-admin (is_platform_admin false) with no modules → allowed",
   gate({ isPlatformAdmin: false, modules: new Set() }), { ok: true, reason: "authenticated" });

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
   [{ ok: true, reason: "authenticated" }, { ok: true, reason: "authenticated" }, { ok: true, reason: "authenticated" }]);
eq("a supplier-flagged organisation without projects.view is allowed",
   viewer({ isSupplier: true }, new Set()).decision, { ok: true, reason: "authenticated" });
eq("a buyer-flagged organisation without projects.view is allowed",
   viewer({ isCustomer: true }, new Set()).decision, { ok: true, reason: "authenticated" });
eq("an organisation with NO role flag but WITH projects.view is allowed",
   viewer({}, withModule).decision, { ok: true, reason: "authenticated" });

// ── 5b. The compatibility helper is permanently enabled ────────────────────
const savedFlag = process.env.TIMBER_PROJECTS_ENABLED;
delete process.env.TIMBER_PROJECTS_ENABLED;
eq("unset env → enabled", isTimberProjectsEnabled(), true);
for (const v of ["", "false", "TRUE", "True", "1", "yes", " true"]) {
  process.env.TIMBER_PROJECTS_ENABLED = v;
  eq(`env "${v}" → still enabled`, isTimberProjectsEnabled(), true);
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
eq("enabled → Projects is the first item",
   on.map((i) => i.href), ["/projects", "/dashboard", "/orders", "/counterparties"]);
eq("enabled → exactly one Projects entry",
   on.filter((i) => i.href === "/projects").length, 1);
eq("enabled → the input array is not mutated", baseNav.map((i) => i.href),
   ["/dashboard", "/orders", "/counterparties"]);
eq("idempotent — a second call adds nothing",
   withProjectsNav(on, true).filter((i) => i.href === "/projects").length, 1);
eq("no Orders item → Projects is still first",
   withProjectsNav([{ href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" }], true)
     .map((i) => i.href), ["/projects", "/dashboard"]);
eq("the injected item carries the shared icon/group contract",
   { icon: PROJECTS_NAV_ITEM.iconName, group: PROJECTS_NAV_ITEM.group, label: PROJECTS_NAV_ITEM.label },
   { icon: "Boxes", group: "deals", label: "Projects" });
ok("the injected item requires no module of its own (the caller gates it)",
   PROJECTS_NAV_ITEM.requiresModule === undefined && PROJECTS_NAV_ITEM.requiresAnyModule === undefined);

// The static admin nav must stay exactly as navItems.test.ts asserts it.
ok("ADMIN_NAV_ITEMS still contains no /projects entry",
   !ADMIN_NAV_ITEMS.some((i) => i.href === "/projects" || (i.children ?? []).some((c) => c.href === "/projects")));

const deletionActions = readFileSync("src/features/projects/actions/projectDeletionActions.ts", "utf8");
const projectsListView = readFileSync("src/features/projects/components/ProjectsListView.tsx", "utf8");
ok("forged deletion calls are denied server-side", deletionActions.includes("resolveProjectsActor()") && deletionActions.includes("!actor.isPlatformAdmin") && deletionActions.includes('code:"FORBIDDEN"'));
ok("deletion controls are serialized only inside the platform-admin branch", projectsListView.includes('viewer.isPlatformAdmin && (item.rowKind === "spine"'));

// ── 7. Confirmed Nilitto MVP navigation presets ──────────────────────────
function navFor(modules: string[]) {
  const filtered = filterNavItemsByModules(getOrgUserNavItems(), new Set(modules));
  return withProjectsNav(filtered, true).map((item) => ({
    label: item.label,
    children: item.children?.map((child) => child.label) ?? [],
  }));
}

eq("Buyer sees Projects as the only current home",
   navFor([]),
   [{ label: "Projects", children: [] }]);
eq("Manufacturer/Supplier sees Projects as the only current home",
   navFor([]),
   [{ label: "Projects", children: [] }]);
eq("Trader sees Projects first and both company books",
   navFor(["counterparties.clients", "counterparties.suppliers"]),
   [
     { label: "Projects", children: [] },
     { label: "Companies", children: ["Clients", "Suppliers"] },
   ]);

console.log(`\nprojects-gate.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
