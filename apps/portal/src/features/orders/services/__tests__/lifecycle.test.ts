/**
 * Pure-logic tests for the deal lifecycle + gate engine (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/lifecycle.test.ts`
 */
import {
  nextStage,
  isCancellableStage,
  evaluateGate,
  isBlockSatisfied,
  rollupSpineStage,
  type GateBlock,
  type GateContext,
} from "../lifecycle";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── stage ladder ──
eq("draft → confirmed", nextStage("draft"), "confirmed");
eq("confirmed → produced", nextStage("confirmed"), "produced");
eq("produced → loaded", nextStage("produced"), "loaded");
eq("loaded → delivered", nextStage("loaded"), "delivered");
eq("delivered → (end)", nextStage("delivered"), null);
eq("cancelled → (end)", nextStage("cancelled"), null);
eq("garbage → (end)", nextStage("zzz"), null);

// ── cancellable up to loaded ──
eq("draft cancellable", isCancellableStage("draft"), true);
eq("loaded cancellable", isCancellableStage("loaded"), true);
eq("delivered NOT cancellable", isCancellableStage("delivered"), false);
eq("cancelled NOT cancellable", isCancellableStage("cancelled"), false);

// ── gate context helpers ──
const emptyCtx: GateContext = { confirmations: new Set(), documents: new Set(), hasPayment: false };
function ctx(over: Partial<GateContext>): GateContext {
  return { confirmations: new Set(), documents: new Set(), hasPayment: false, ...over };
}

// ── each building block ──
const sellerSignoff: GateBlock = { type: "party_signoff", party: "seller" };
const buyerSignoff: GateBlock = { type: "party_signoff", party: "buyer" };
const acceptance: GateBlock = { type: "acceptance" };
const payment: GateBlock = { type: "condition", condition: "payment_recorded" };
const anyDoc: GateBlock = { type: "condition", condition: "document_present" };
const invoiceDoc: GateBlock = { type: "condition", condition: "document_present", docType: "invoice" };

eq("seller sign-off unmet", isBlockSatisfied(sellerSignoff, emptyCtx), false);
eq("seller sign-off met", isBlockSatisfied(sellerSignoff, ctx({ confirmations: new Set(["party_signoff:seller"]) })), true);
eq("buyer sign-off isolated from seller", isBlockSatisfied(buyerSignoff, ctx({ confirmations: new Set(["party_signoff:seller"]) })), false);
eq("acceptance met", isBlockSatisfied(acceptance, ctx({ confirmations: new Set(["acceptance:acceptance"]) })), true);
eq("payment unmet", isBlockSatisfied(payment, emptyCtx), false);
eq("payment met", isBlockSatisfied(payment, ctx({ hasPayment: true })), true);
eq("any-doc met by any doc", isBlockSatisfied(anyDoc, ctx({ documents: new Set(["cmr"]) })), true);
eq("invoice-doc unmet by other doc", isBlockSatisfied(invoiceDoc, ctx({ documents: new Set(["cmr"]) })), false);
eq("invoice-doc met by invoice", isBlockSatisfied(invoiceDoc, ctx({ documents: new Set(["invoice"]) })), true);

// ── evaluateGate ──
eq("empty gate auto-satisfies", evaluateGate([], emptyCtx), { satisfied: true, unmet: [] });
eq(
  "all-three gate unmet lists all",
  evaluateGate([sellerSignoff, payment, acceptance], emptyCtx).unmet.length,
  3,
);
eq(
  "all-three gate satisfied",
  evaluateGate([sellerSignoff, payment, acceptance], ctx({
    confirmations: new Set(["party_signoff:seller", "acceptance:acceptance"]),
    hasPayment: true,
  })).satisfied,
  true,
);
eq(
  "partial gate reports the one unmet",
  evaluateGate([sellerSignoff, buyerSignoff], ctx({ confirmations: new Set(["party_signoff:seller"]) })).unmet,
  [buyerSignoff],
);

// ── spine rollup (5-stage) ──
eq("rollup empty → draft", rollupSpineStage([]), "draft");
eq("rollup least-advanced active", rollupSpineStage(["loaded", "confirmed", "delivered"]), "confirmed");
eq("rollup ignores cancelled legs", rollupSpineStage(["cancelled", "loaded"]), "loaded");
eq("rollup all cancelled → cancelled", rollupSpineStage(["cancelled", "cancelled"]), "cancelled");
eq("rollup single delivered", rollupSpineStage(["delivered"]), "delivered");

console.log(`\nlifecycle.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
