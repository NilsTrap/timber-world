/**
 * Renderer smoke test — every doc type produces a valid, loadable PDF (validated
 * with pdf-lib), exercising the interim generic renderer. No DB.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/document-render.test.ts`
 */
import { PDFDocument } from "pdf-lib";
import { renderDocument, isRendererImplemented } from "../documents";
import { buildDocumentData } from "../documents/assemble";
import type { DocType, OrderLineItem } from "../dealModel";

let passed = 0;
let failed = 0;
function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

function li(over: Partial<OrderLineItem>): OrderLineItem {
  return {
    side: "sell", lineNo: 1, productName: "Oak board", woodSpecies: "Oak", humidity: null, processing: "Planed",
    quality: "A", productType: null, gradeNote: null, productNameOptionId: null, woodSpeciesOptionId: null,
    humidityOptionId: null, processingOptionId: null, qualityOptionId: null, productTypeOptionId: null,
    thickness: "20", width: "100", length: "2000", pieces: "50", volumeM3: 2, unit: "m3",
    unitPriceCents: 45000, vatRate: null, lineTotalCents: null, notes: null, ...over,
  };
}

const ALL_TYPES: DocType[] = ["sales_spec", "purchase_spec", "contract", "proforma_invoice", "invoice", "packing_list", "cmr"];

(async () => {
  for (const docType of ALL_TYPES) {
    ok(`${docType} renderer implemented`, isRendererImplemented(docType));
    const data = buildDocumentData({
      docType, side: docType === "purchase_spec" ? "buy" : "sell",
      docNumber: "TEST-1", docDate: "2026-06-16T00:00:00Z", dealCode: "TIMSOM001", currency: "EUR",
      seller: { name: "Timber International", country: "LV", regNo: "40000", vatNo: "LV40000", bankName: "Swedbank", bankAccount: "LV00..." },
      buyer: { name: "Somms Ltd", country: "GB", regNo: "GB123" },
      incoterms: "FCA", incotermsPlace: "Riga", advancePct: 30, paymentTerms: "30/70 advance/balance",
      deliveryTerms: "By road", deliveryDeadline: "July 2026", notes: "Handle with care",
      externalRefs: [{ refType: "client_po", refValue: "PO-9", label: null }],
      lineItems: [li({ lineNo: 1 }), li({ lineNo: 2, side: docType === "purchase_spec" ? "buy" : "sell", productName: "Ash board", woodSpecies: "Ash", volumeM3: 1.5, unitPriceCents: 38000 })],
    });
    const rendered = renderDocument(data);
    ok(`${docType} mime`, rendered.mimeType === "application/pdf");
    ok(`${docType} starts with %PDF`, Buffer.from(rendered.bytes.slice(0, 5)).toString("latin1").startsWith("%PDF"));
    ok(`${docType} filename has .pdf`, rendered.fileName.endsWith(".pdf"));
    try {
      const pdf = await PDFDocument.load(rendered.bytes);
      ok(`${docType} pdf-lib loads ≥1 page`, pdf.getPageCount() >= 1);
    } catch (e) {
      failed++;
      console.error(`✗ ${docType} pdf-lib load: ${(e as Error).message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
