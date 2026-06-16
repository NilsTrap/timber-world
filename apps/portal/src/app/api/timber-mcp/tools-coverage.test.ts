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

console.log(`\n${passed} passed, ${failed} failed — ${TOOLS.length} tools across ${LIFECYCLE_STEPS.length} lifecycle steps`);
if (failed > 0) process.exitCode = 1;
