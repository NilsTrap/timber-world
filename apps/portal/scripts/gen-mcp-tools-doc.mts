/**
 * Regenerate docs/timber-mcp-tools.md from the tool catalog (single source of
 * truth). Run from apps/portal:
 *   ../../tests/rls-and-perf/node_modules/.bin/tsx scripts/gen-mcp-tools-doc.mts \
 *     > ../../docs/timber-mcp-tools.md
 */
import { TOOLS, LIFECYCLE_STEPS } from "../src/app/api/timber-mcp/tools";

const byStep = new Map<string, typeof TOOLS>();
for (const t of TOOLS) {
  const arr = byStep.get(t.lifecycle) ?? [];
  arr.push(t);
  byStep.set(t.lifecycle, arr as typeof TOOLS);
}
const writes = TOOLS.filter((t) => !t.readOnly).length;
const reads = TOOLS.filter((t) => t.readOnly).length;

let out = "";
out += `# Timber MCP tools — authoritative list\n\n`;
out += `_Generated from \`apps/portal/src/app/api/timber-mcp/tools.ts\` (the single source of truth) by \`apps/portal/scripts/gen-mcp-tools-doc.mts\`. Regenerate after adding a tool; do not hand-edit._\n\n`;
out += `**${TOOLS.length} tools** across **${LIFECYCLE_STEPS.length} lifecycle steps** — ${reads} read-only, ${writes} writes.\n\n`;
out += `Endpoint: \`POST /api/timber-mcp\` (JSON-RPC 2.0; Oscar Workflows contract). Auth = one bearer token of two: the **READONLY** token exposes the ${reads} read tools only (chat agents — prompt-injection blast-radius containment); the **FULL** token exposes all ${TOOLS.length} (the workflow engine). Every **write** below is FULL-token only.\n\n`;
out += `Each entry shows the first sentence of the tool's description; call the endpoint's \`tools/list\` for the full input schema.\n\n`;

for (const step of LIFECYCLE_STEPS) {
  const arr = byStep.get(step) ?? [];
  out += `## ${step} (${arr.length})\n\n`;
  for (const t of arr) {
    const first = t.description.split(/(?<=\.)\s/)[0].trim();
    const tag = t.readOnly ? "read" : "**write**";
    out += `- \`${t.name}\` (${tag}) — ${first}\n`;
  }
  out += `\n`;
}
process.stdout.write(out);
