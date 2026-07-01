/**
 * Pure-logic tests for the bilateral deal code + viewer-relative direction (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/bilateral.test.ts`
 */
import { buildBilateralDealCode, bilateralDealCodeScope } from "../numbering";
import { dealDirectionFor } from "../orderDeals";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── bilateral deal code SELLER-BUYER-NNN ──
eq("TIM/SOM/1", buildBilateralDealCode("TIM", "SOM", 1), "TIM-SOM-001");
eq("lowercase + truncate", buildBilateralDealCode("timber", "somebody", 42), "TIM-SOM-042");
eq("empty codes fall back", buildBilateralDealCode("", "", 7), "TIM-XXX-007");
eq("scope", bilateralDealCodeScope("tim", "som"), "deal:TIM:SOM");

// ── direction is relative to the viewer, never absolute ──
const S = "seller-1";
const B = "buyer-1";
eq("seller org → sell", dealDirectionFor(S, B, S), "sell");
eq("buyer org → buy", dealDirectionFor(S, B, B), "buy");
eq("third party → observer", dealDirectionFor(S, B, "someone-else"), "observer");
eq("no viewer → observer", dealDirectionFor(S, B, null), "observer");
eq("middle leg: same deal, opposite views", [dealDirectionFor(S, B, S), dealDirectionFor(S, B, B)], ["sell", "buy"]);

console.log(`\nbilateral.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
