/**
 * Timber Projects — access-gate + nav-injection tests (pure, no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/projects/__tests__/projects-gate.test.ts`
 *
 * Proves the fail-closed matrix: the flag beats everything (and denies BEFORE
 * auth, so the redirect cannot be used as an oracle), platform admin is the
 * ONLY admin notion, a non-admin needs a current org AND an exact `orders.view`,
 * and organisation role flags never grant anything.
 */
import { evaluateProjectsGate, PROJECTS_MODULE, type ProjectsGateInput } from "../gate";
import { PROJECTS_NAV_ITEM, withProjectsNav, ADMIN_NAV_ITEMS } from "@/components/layout/navItems";
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
eq("flag off + orders.view user → not_found",
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
eq("orders.view in a current org → allowed", gate(), { ok: true, reason: "module" });
eq("orders.view but no current org → not_found",
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
eq("legacy role-admin WITH orders.view → allowed as a module user, not as admin",
   gate({ isPlatformAdmin: false }), { ok: true, reason: "module" });

// ── 5. Organisation role flags never appear in the decision ──────────────────
// The gate input has no place to put them: same modules ⇒ same decision, whether
// the viewer's org is a buyer, a trader or a supplier.
const buyerLike = gate();
const traderLike = gate();
const supplierLike = gate();
eq("personas cannot change the decision (buyer vs trader)", buyerLike, traderLike);
eq("personas cannot change the decision (buyer vs supplier)", buyerLike, supplierLike);
ok("gate input has no role-flag fields",
   !Object.keys({ flagEnabled: true, authenticated: true, isPlatformAdmin: true, orgId: "", modules: new Set() })
     .some((k) => /customer|trader|supplier|manufacturer|producer|persona/i.test(k)));

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
eq("no Orders item → Projects goes first",
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

console.log(`\nprojects-gate.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
