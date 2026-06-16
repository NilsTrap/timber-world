/**
 * Pure-logic tests for the order-deal numbering + VAT (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/deal-numbering.test.ts`
 */
import { buildDealCode, clientCodeFromName, pad, yyyymmdd, buildDocNumber } from "../numbering";
import { resolveVat } from "../vat";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

eq("pad(5,3)", pad(5, 3), "005");
eq("clientCodeFromName(Somms Ltd)", clientCodeFromName("Somms Ltd"), "SOM");
eq("clientCodeFromName(empty)", clientCodeFromName(""), "XXX");
eq("clientCodeFromName(Ab)", clientCodeFromName("Ab"), "ABX");
eq("buildDealCode(TIM,SOM,1)", buildDealCode("TIM", "SOM", 1), "TIMSOM001");
eq("buildDealCode default entity", buildDealCode("", "XXX", 12), "TIMXXX012");
eq("yyyymmdd", yyyymmdd("2026-06-16T09:30:00Z"), "20260616");
eq("docNumber sales_spec", buildDocNumber({ docType: "sales_spec", entityCode: "TIM", date: "2026-06-16", seq: 3 }), "Spec No 3");
eq("docNumber contract first", buildDocNumber({ docType: "contract", entityCode: "TIM", date: "2026-06-16", seq: 1 }), "S-20260616");
eq("docNumber contract second", buildDocNumber({ docType: "contract", entityCode: "TIM", date: "2026-06-16", seq: 2 }), "S-20260616-2");
eq("docNumber invoice TWG", buildDocNumber({ docType: "invoice", entityCode: "TWG", date: "2026-06-16", seq: 8 }), "TWG0008");
eq("docNumber proforma", buildDocNumber({ docType: "proforma_invoice", entityCode: "TIM", date: "2026-06-16", seq: 23 }), "AV0023");

eq("VAT LV→LV", resolveVat({ fromCountry: "LV", toCountry: "LV" }).rule, "domestic_reverse_charge");
eq("VAT GB→GB rate", resolveVat({ fromCountry: "GB", toCountry: "GB" }).rate, 20);
eq("VAT LV→SE", resolveVat({ fromCountry: "LV", toCountry: "SE" }).rule, "intra_eu");
eq("VAT LV→GB export", resolveVat({ fromCountry: "LV", toCountry: "GB" }).rule, "export");
eq("VAT unknown", resolveVat({ fromCountry: "LV", toCountry: null }).rule, "unknown");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
