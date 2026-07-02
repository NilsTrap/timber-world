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

// 8. The access step is read-only in this phase (group WRITES deferred to a later epic).
ok("access step is read-only for now", TOOLS.filter((t) => t.lifecycle === "access").every((t) => t.readOnly));

// 9. create_deal exposes the bilateral buy-leg auto-spawn (needs_sourcing + source_organisation_id).
const createDealProps =
  ((byName.get("timber_create_deal")?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
ok("create_deal exposes needs_sourcing", "needs_sourcing" in createDealProps);
ok("create_deal exposes source_organisation_id", "source_organisation_id" in createDealProps);

console.log(`\n${passed} passed, ${failed} failed — ${TOOLS.length} tools across ${LIFECYCLE_STEPS.length} lifecycle steps`);
if (failed > 0) process.exitCode = 1;
