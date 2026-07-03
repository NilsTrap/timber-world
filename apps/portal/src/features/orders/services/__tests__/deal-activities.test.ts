/**
 * Epic C · pure-logic tests for the direction resolver + §7 activity guidance (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/deal-activities.test.ts`
 */
import { resolveViewerDirection } from "../orderDeals";
import { activitiesFor, suggestedDocsFor, DEAL_ACTIVITIES } from "../dealActivities";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

const S = "seller-org";
const B = "buyer-org";

// ── C1 · viewer-relative direction ───────────────────────────────────────────
eq("viewer is seller → sell", resolveViewerDirection(S, B, S, "buy_sell"), "sell");
eq("viewer is buyer → buy", resolveViewerDirection(S, B, B, "buy_sell"), "buy");
// A counterparty producer stands on the SELLER side of the house's purchase_only
// leg → it must read as a SELL to them, NOT the house's "buy" label.
eq("producer (seller) on purchase_only → sell", resolveViewerDirection(S, B, S, "purchase_only"), "sell");
// Owner/admin is party to neither leg (observer) → fall back to the deal's kind
// (house perspective): purchase_only = buy, everything else = sell.
eq("observer + purchase_only → buy", resolveViewerDirection(S, B, "admin-org", "purchase_only"), "buy");
eq("observer + buy_sell → sell", resolveViewerDirection(S, B, "admin-org", "buy_sell"), "sell");
eq("observer + null org → sell", resolveViewerDirection(S, B, null, "buy_sell"), "sell");
eq("observer + null kind → sell", resolveViewerDirection(S, B, "x", null), "sell");

// ── C2 · §7 activities (verbatim, correct set per stage+direction) ────────────
eq("draft/sell has 5 activities", activitiesFor("draft", "sell").length, 5);
eq("draft/sell first", activitiesFor("draft", "sell")[0], "build the sales spec");
eq("draft/sell last", activitiesFor("draft", "sell")[4], "secure the customer's agreement");
eq("draft/buy has 5 activities", activitiesFor("draft", "buy").length, 5);
eq("draft/buy has purchase order", activitiesFor("draft", "buy").includes("prepare the purchase order"), true);
eq("confirmed/sell has 2", activitiesFor("confirmed", "sell").length, 2);
eq("produced/buy has 5", activitiesFor("produced", "buy").length, 5);
eq("produced/buy packing list & labels", activitiesFor("produced", "buy").includes("prepare the packing list & labels"), true);
eq("loaded/buy obtains CMR", activitiesFor("loaded", "buy").includes("obtain the transport documents (CMR)"), true);
eq("delivered/sell closes deal", activitiesFor("delivered", "sell").includes("close the deal"), true);
// Cancelled is not a work stage — no activity list (the card shows the §7 note).
eq("cancelled has no activities", activitiesFor("cancelled", "sell"), []);
eq("unknown stage → empty", activitiesFor("nope", "buy"), []);
// Every active stage carries BOTH directions.
eq("all 5 stages present", Object.keys(DEAL_ACTIVITIES).sort(), ["confirmed", "delivered", "draft", "loaded", "produced"]);

// ── C3 · stage-suggested documents (guidance, ordered) ────────────────────────
eq("draft/sell primary doc", suggestedDocsFor("draft", "sell")[0], "sales_spec");
eq("draft/buy suggests purchase order", suggestedDocsFor("draft", "buy"), ["purchase_spec"]);
eq("loaded/buy suggests cmr", suggestedDocsFor("loaded", "buy").includes("cmr"), true);
eq("delivered/sell suggests invoice", suggestedDocsFor("delivered", "sell"), ["invoice"]);
eq("cancelled suggests nothing", suggestedDocsFor("cancelled", "sell"), []);

console.log(`\ndeal-activities.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
