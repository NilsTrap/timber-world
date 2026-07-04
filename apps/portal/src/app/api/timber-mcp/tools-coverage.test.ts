/**
 * MCP-coverage check (E5 completeness rule): every deterministic deal-lifecycle
 * step must be served by at least one registered MCP tool — no UI-only mutations.
 * Pure (imports the tool catalog), so it runs as a unit test.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/app/api/timber-mcp/tools-coverage.test.ts`
 */
import { TOOLS, LIFECYCLE_STEPS } from "./tools";

let passed = 0;
let failed = 0;
function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

// 1. Completeness: every lifecycle step has ≥1 tool.
for (const step of LIFECYCLE_STEPS) {
  const tools = TOOLS.filter((t) => t.lifecycle === step).map((t) => t.name);
  ok(`lifecycle step "${step}" covered by a tool (${tools.join(", ") || "NONE"})`, tools.length >= 1);
}

// 2. Every tool's lifecycle is a known step.
for (const t of TOOLS) {
  ok(`tool ${t.name} has a valid lifecycle (${t.lifecycle})`, (LIFECYCLE_STEPS as readonly string[]).includes(t.lifecycle));
}

// 3. Tool names are unique.
const names = TOOLS.map((t) => t.name);
ok("tool names are unique", new Set(names).size === names.length);

// 4. Every tool name is timber_-prefixed + has a JSON-schema object inputSchema.
for (const t of TOOLS) {
  ok(`${t.name} is timber_-prefixed`, t.name.startsWith("timber_"));
  ok(`${t.name} inputSchema is an object schema`, (t.inputSchema as { type?: string }).type === "object");
}

// 5. Read-only tools are reads (named *_list/_get/_definitions/_options); writes are not.
for (const t of TOOLS) {
  const looksRead = /_(list|get)_/.test(t.name) || /(_definitions|_options|_missing_docs)$/.test(t.name);
  if (t.readOnly) ok(`${t.name} (readOnly) is named like a read`, looksRead);
}

// 6. E7: the new spine/gates/access tools are all registered.
const byName = new Map(TOOLS.map((t) => [t.name, t]));
for (const req of [
  "timber_get_spine", "timber_list_spine_deals", "timber_get_spine_lineage",
  "timber_get_advance_status", "timber_list_gate_configs", "timber_advance_deal",
  "timber_record_gate_confirmation", "timber_cancel_deal",
  "timber_list_access_groups", "timber_get_access_group",
  "timber_list_user_access_groups", "timber_list_users",
]) {
  ok(`E7 tool ${req} is registered`, byName.has(req));
}

// 7. The "gates" step must expose BOTH a read (evaluate/list) AND a state-changing
//    write (advance/cancel) — the completeness rule forbids UI-only lifecycle mutations.
const gateTools = TOOLS.filter((t) => t.lifecycle === "gates");
ok("gates step has a read tool", gateTools.some((t) => t.readOnly));
ok("gates step has a write tool", gateTools.some((t) => !t.readOnly));
const advance = byName.get("timber_advance_deal");
ok("a deal can be advanced through its gate via MCP (write)", advance != null && advance.readOnly === false);
const cancel = byName.get("timber_cancel_deal");
ok("a deal can be cancelled via MCP (write)", cancel != null && cancel.readOnly === false);

// 8. J3: the access step now exposes BOTH reads AND writes (group CRUD + rights +
//    user-group assignment). All access writes are full-token only.
const accessTools = TOOLS.filter((t) => t.lifecycle === "access");
ok("access step has a read tool", accessTools.some((t) => t.readOnly));
ok("access step has a write tool", accessTools.some((t) => !t.readOnly));
for (const req of ["timber_set_user_groups", "timber_upsert_access_group", "timber_delete_access_group"]) {
  const t = byName.get(req);
  ok(`J3 access write ${req} is registered as a full-token write`, t != null && t.readOnly === false);
}

// 9. create_deal exposes the bilateral buy-leg auto-spawn (needs_sourcing + source_organisation_id).
const createDealProps =
  ((byName.get("timber_create_deal")?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
ok("create_deal exposes needs_sourcing", "needs_sourcing" in createDealProps);
ok("create_deal exposes source_organisation_id", "source_organisation_id" in createDealProps);

// L1 (2026-07-04): spine-Lego leg parity — create_deal can fork a leg onto an
// origin deal's spine (copying its lines), and start_sourcing's buy-leg buyer is
// editable (the Meeting-1 wrong-buyer fix).
ok("L1: create_deal exposes origin_deal_id (leg on a spine)", "origin_deal_id" in createDealProps);
ok("L1: create_deal exposes copy_lines", "copy_lines" in createDealProps);
const startSourcingProps =
  ((byName.get("timber_start_sourcing")?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
ok("L1: start_sourcing exposes editable buyer_organisation_id", "buyer_organisation_id" in startSourcingProps);

// ── J (2026-07-04): MCP parity for Vilma — every new UI action is a tool ──────
// The completeness rule becomes EXECUTABLE for the J additions: a future UI action
// shipped without its MCP tool (or a lost registration) FAILS this build.
const props = (n: string) =>
  ((byName.get(n)?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
const isWrite = (n: string) => { const t = byName.get(n); return t != null && t.readOnly === false; };
const isRead = (n: string) => { const t = byName.get(n); return t != null && t.readOnly === true; };

// J1 · deal-flow parity — firming / sourcing / margin each MUST have a write tool.
for (const step of ["firming", "sourcing", "margin"] as const) {
  const stepTools = TOOLS.filter((t) => t.lifecycle === step);
  ok(`"${step}" step has a write tool`, stepTools.some((t) => !t.readOnly));
}
ok("J1: timber_firm_order_specification is a full-token write", isWrite("timber_firm_order_specification"));
ok("J1: timber_start_sourcing is a full-token write", isWrite("timber_start_sourcing"));
ok("J1: timber_set_margin_approval is a full-token write", isWrite("timber_set_margin_approval"));
// J1 · signee overrides (G3) settable via update_deal.
for (const f of ["seller_signee_name", "seller_signee_role", "buyer_signee_name", "buyer_signee_role"]) {
  ok(`J1: update_deal exposes ${f}`, f in props("timber_update_deal"));
}

// J2 · CRM parity — org step has BOTH create AND update; update_org carries the role flags.
ok("J2: org step has a create tool", byName.has("timber_create_org"));
ok("J2: org step has an update tool (timber_update_org)", isWrite("timber_update_org"));
for (const f of ["is_customer", "is_manufacturer", "is_producer", "is_supplier", "is_active"]) {
  ok(`J2: update_org exposes role/status flag ${f}`, f in props("timber_update_org"));
}

// J4 · catalog & stock — the step needs reads AND a stock write; the write guard is on the service.
const catalogTools = TOOLS.filter((t) => t.lifecycle === "catalog");
ok("catalog step has a read tool", catalogTools.some((t) => t.readOnly));
ok("catalog step has a write tool", catalogTools.some((t) => !t.readOnly));
ok("J4: timber_list_catalog_products is a read", isRead("timber_list_catalog_products"));
ok("J4: timber_get_catalog_variant is a read", isRead("timber_get_catalog_variant"));
ok("J4: timber_get_variant_stock is a read", isRead("timber_get_variant_stock"));
ok("J4: timber_set_variant_stock is a full-token write", isWrite("timber_set_variant_stock"));

console.log(`\n${passed} passed, ${failed} failed — ${TOOLS.length} tools across ${LIFECYCLE_STEPS.length} lifecycle steps`);
if (failed > 0) process.exitCode = 1;
