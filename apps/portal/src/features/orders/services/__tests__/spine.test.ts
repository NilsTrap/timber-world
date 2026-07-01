/**
 * Pure-logic tests for the spine layer (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/spine.test.ts`
 */
import { buildSpineCode, childSpineCode } from "../numbering";
import { rollupSpineStatus } from "../spines";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── spine ID generator ──
eq("buildSpineCode(1)", buildSpineCode(1), "SP-001");
eq("buildSpineCode(42)", buildSpineCode(42), "SP-042");
eq("buildSpineCode(123)", buildSpineCode(123), "SP-123");

// ── split child codes ──
eq("childSpineCode(SP-042, a)", childSpineCode("SP-042", "a"), "SP-042-A");
eq("childSpineCode(SP-042, B)", childSpineCode("SP-042", "B"), "SP-042-B");
eq("childSpineCode strips junk", childSpineCode("SP-042", " b! "), "SP-042-B");

// ── status rollup (least-advanced active leg) ──
eq("rollup empty → draft", rollupSpineStatus([]), "draft");
eq("rollup all cancelled → cancelled", rollupSpineStatus(["cancelled", "cancelled"]), "cancelled");
eq("rollup min = confirmed", rollupSpineStatus(["loaded", "confirmed", "completed"]), "confirmed");
eq("rollup ignores cancelled", rollupSpineStatus(["cancelled", "loaded", "shipped"]), "shipped");
eq("rollup single draft", rollupSpineStatus(["draft"]), "draft");
eq("rollup fully completed chain", rollupSpineStatus(["completed", "completed"]), "completed");

console.log(`\nspine.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
