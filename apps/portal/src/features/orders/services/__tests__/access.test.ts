/**
 * Pure-logic tests for the E4 access engine (field wall, no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/access.test.ts`
 */
import {
  ORDER_FIELD_DOMAINS,
  resolveFieldAccess,
  projectFields,
  disallowedEdits,
  projectDealView,
} from "../dealFields";
import {
  type AccessProfile,
  type FieldDomain,
  type FieldGrant,
  fullAccessProfile,
  emptyAccessProfile,
} from "@/lib/access/types";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

/** Inline AccessProfile builder. */
function profile(
  fieldDomains: Partial<Record<FieldDomain, FieldGrant>>,
  fieldOverrides: Record<string, FieldGrant> = {},
): AccessProfile {
  return {
    groupIds: [],
    modules: new Set(),
    dealVisibility: new Set(),
    fieldDomains,
    fieldOverrides,
    scope: "company",
    actions: new Set(),
  };
}

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}

// ── resolveFieldAccess: defaults (deny by default, general open) ──
const emptyAccess = resolveFieldAccess(emptyAccessProfile());
eq("unknown field (general) visible on empty profile", emptyAccess.canSee("name"), true);
eq("unknown field NOT editable on empty profile", emptyAccess.canEdit("name"), false);
eq("deal_terms hidden by default", emptyAccess.canSee("totalPricePence"), false);
eq("margin hidden by default", emptyAccess.canSee("plTotalValue"), false);
eq("supplier_identity hidden by default", emptyAccess.canSee("producerOrganisationName"), false);
eq("chain hidden by default", emptyAccess.canSee("spineId"), false);

// ── resolveFieldAccess: domain grants ──
const viewOnlyTerms = resolveFieldAccess(profile({ deal_terms: { visible: true, editable: false } }));
eq("view-only domain grant → canSee", viewOnlyTerms.canSee("totalPricePence"), true);
eq("view-only domain grant → NOT canEdit", viewOnlyTerms.canEdit("totalPricePence"), false);

const invisibleEditable = resolveFieldAccess(profile({ deal_terms: { visible: false, editable: true } }));
eq("editable-but-invisible grant → NOT canSee", invisibleEditable.canSee("totalPricePence"), false);
eq("editable requires visible → NOT canEdit", invisibleEditable.canEdit("totalPricePence"), false);

const fullTerms = resolveFieldAccess(profile({ deal_terms: { visible: true, editable: true } }));
eq("visible+editable grant → canEdit", fullTerms.canEdit("totalPricePence"), true);
eq("domainEditable reflects grant", fullTerms.domainEditable("deal_terms"), true);

// ── resolveFieldAccess: per-field overrides win over domain ──
const hideOneField = resolveFieldAccess(
  profile(
    { deal_terms: { visible: true, editable: true } },
    { totalPricePence: { visible: false, editable: false } },
  ),
);
eq("override hides field inside visible domain", hideOneField.canSee("totalPricePence"), false);
eq("sibling field in same domain stays visible", hideOneField.canSee("valueCents"), true);

const showOneField = resolveFieldAccess(
  profile({}, { plTotalValue: { visible: true, editable: false } }),
);
eq("override shows field of hidden domain", showOneField.canSee("plTotalValue"), true);
eq("show-only override → NOT canEdit", showOneField.canEdit("plTotalValue"), false);
eq("other margin fields stay hidden", showOneField.canSee("plWorkValue"), false);

const editOverride = resolveFieldAccess(
  profile({}, { plTotalValue: { visible: true, editable: true } }),
);
eq("visible+editable override on hidden domain → canEdit", editOverride.canEdit("plTotalValue"), true);

// ── projectFields: stripOrderPricing parity ──
const fakeOrder = {
  // general
  id: "ord-1",
  name: "Stairs batch 7",
  orderNumber: "TW-0007",
  status: "confirmed",
  // deal_terms
  totalPricePence: 12345,
  valueCents: 99900,
  // margin
  maxM3: 12.5,
  eurPerM3: 480,
  workPerPiece: 15,
  invoicedWork: 300,
  usedWork: 250,
  invoicedTransport: 120,
  usedTransport: 100,
  plMaterialValue: 111,
  plWorkValue: 222,
  plTransportValue: 333,
  plMaterialsValue: 444,
  plTotalValue: 555,
  plPercentFromInvoice: 12,
  // financial_docs
  advanceInvoiceNumber: "ADV-1",
  invoiceNumber: "INV-1",
  transportInvoiceNumber: "TRN-1",
  transportPrice: 250,
  // production
  treadM3: 1.2,
  productionMaterial: "Oak",
  productionWork: 42,
  productionInvoiceNumber: "PRD-1",
  woodArt: "CNC set",
  woodArtInvoiceNumber: "WA-1",
  // logistics
  dateLoaded: "2026-07-01",
  plannedDate: "2026-07-05",
  packageNumber: "PKG-9",
};

const PRICING_PARITY_KEYS = [
  "totalPricePence", "maxM3", "eurPerM3", "workPerPiece", "invoicedWork", "usedWork",
  "invoicedTransport", "usedTransport", "plMaterialValue", "plWorkValue", "plTransportValue",
  "plMaterialsValue", "plTotalValue", "plPercentFromInvoice", "advanceInvoiceNumber",
  "invoiceNumber", "transportInvoiceNumber", "transportPrice", "valueCents",
];

const productionLogistics = resolveFieldAccess(
  profile({
    production: { visible: true, editable: true },
    logistics: { visible: true, editable: true },
  }),
);
const stripped = projectFields(fakeOrder, productionLogistics, ORDER_FIELD_DOMAINS) as Record<string, unknown>;
eq("pricing parity fields blanked exactly like stripOrderPricing", pick(stripped, PRICING_PARITY_KEYS), {
  totalPricePence: 0, maxM3: 0, eurPerM3: 0, workPerPiece: 0, invoicedWork: 0, usedWork: 0,
  invoicedTransport: 0, usedTransport: 0, plMaterialValue: 0, plWorkValue: 0, plTransportValue: 0,
  plMaterialsValue: 0, plTotalValue: 0, plPercentFromInvoice: 0, advanceInvoiceNumber: null,
  invoiceNumber: null, transportInvoiceNumber: null, transportPrice: null, valueCents: null,
});
eq("general name untouched", stripped.name, "Stairs batch 7");
eq("general orderNumber untouched", stripped.orderNumber, "TW-0007");
eq("general status untouched", stripped.status, "confirmed");
eq("production field passes with production domain", stripped.productionMaterial, "Oak");
eq("wood-art invoice passes with production domain", stripped.woodArtInvoiceNumber, "WA-1");
eq("logistics field passes with logistics domain", stripped.dateLoaded, "2026-07-01");

const pricingVisible = resolveFieldAccess(
  profile({
    deal_terms: { visible: true, editable: false },
    margin: { visible: true, editable: false },
    financial_docs: { visible: true, editable: false },
  }),
);
const withPricing = projectFields(fakeOrder, pricingVisible, ORDER_FIELD_DOMAINS) as Record<string, unknown>;
eq("deal_terms passes when granted", withPricing.totalPricePence, 12345);
eq("margin passes when granted", withPricing.plTotalValue, 555);
eq("financial_docs passes when granted", withPricing.advanceInvoiceNumber, "ADV-1");

const noProduction = projectFields(fakeOrder, emptyAccess, ORDER_FIELD_DOMAINS) as Record<string, unknown>;
eq("production text fields blanked without production domain", pick(noProduction, ["productionMaterial", "woodArt", "productionInvoiceNumber"]), {
  productionMaterial: null, woodArt: null, productionInvoiceNumber: null,
});
eq("numeric production field blanked to zero", noProduction.productionWork, 0);

// ── disallowedEdits: legacy production-tab parity ──
eq(
  "production-tab field set → all allowed",
  disallowedEdits(
    { dateLoaded: "2026-07-01", plannedDate: "2026-07-05", treadM3: 1.2, productionMaterial: "Oak", woodArtInvoiceNumber: "WA-2" },
    productionLogistics,
  ),
  [],
);
eq("general field edit rejected", disallowedEdits({ name: "renamed" }, productionLogistics), ["name"]);
eq("pricing edit rejected", disallowedEdits({ totalPricePence: 1 }, productionLogistics), ["totalPricePence"]);
eq(
  "party edit rejected",
  disallowedEdits({ customerOrganisationId: "org-x" }, productionLogistics),
  ["customerOrganisationId"],
);
eq(
  "undefined values ignored",
  disallowedEdits({ dateLoaded: "2026-07-01", name: undefined, totalPricePence: undefined }, productionLogistics),
  [],
);
eq(
  "mixed submit returns only the disallowed keys",
  disallowedEdits({ dateLoaded: "2026-07-02", totalPricePence: 5 }, productionLogistics),
  ["totalPricePence"],
);

// ── projectDealView ──
const HIDDEN = { id: null, code: null, name: null };
function dealView(dealKind = "buy_sell") {
  return {
    dealKind,
    incoterms: "FOB",
    incotermsPlace: "Riga",
    advancePct: 30,
    paymentTerms: "30 days",
    deliveryTerms: "DAP site",
    transportBilling: "seller",
    customer: { id: "org-cust", code: "CST", name: "Customer Org" },
    seller: { id: "org-sell", code: "TWP", name: "Timber World" },
    producer: { id: "org-prod", code: "WART", name: "Wood ART" },
    buyer: { id: "org-buy", code: "BYR", name: "Buyer Org" },
    spineId: "spine-1",
    upstreamDealId: "deal-0",
    lineItems: [
      { id: "li-sell", side: "sell", unitPriceCents: 1000, vatRate: 21, lineTotalCents: 5000 },
      { id: "li-buy", side: "buy", unitPriceCents: 800, vatRate: 21, lineTotalCents: 4000 },
    ],
  };
}

// Salesperson-like: deal_terms + customer_identity; NO supplier_identity, NO chain.
const salesAccess = resolveFieldAccess(
  profile({
    deal_terms: { visible: true, editable: false },
    customer_identity: { visible: true, editable: false },
  }),
);
const salesView = projectDealView(dealView(), salesAccess, "org-sell");
eq("buy-side items dropped without supplier_identity", salesView.lineItems.map((i) => i.id), ["li-sell"]);
eq("producer embed hidden without supplier_identity", salesView.producer, HIDDEN);
eq("spineId hidden without chain", salesView.spineId, null);
eq("upstreamDealId hidden without chain", salesView.upstreamDealId, null);
eq("customer embed kept with customer_identity", salesView.customer.id, "org-cust");
eq("sell-side prices kept with deal_terms", salesView.lineItems[0]?.unitPriceCents, 1000);
eq("incoterms kept with deal_terms", salesView.incoterms, "FOB");

// Buyer viewer with empty profile (general only).
const buyerView = projectDealView(dealView(), emptyAccess, "org-buy");
eq("buyer embed kept for the buyer org itself", buyerView.buyer.id, "org-buy");
eq("seller embed always kept", buyerView.seller.id, "org-sell");
eq(
  "terms nulled without deal_terms",
  pick(buyerView as unknown as Record<string, unknown>, ["incoterms", "incotermsPlace", "advancePct", "paymentTerms", "deliveryTerms"]),
  { incoterms: null, incotermsPlace: null, advancePct: null, paymentTerms: null, deliveryTerms: null },
);
eq(
  "remaining item prices nulled without deal_terms",
  pick(buyerView.lineItems[0] as unknown as Record<string, unknown>, ["unitPriceCents", "vatRate", "lineTotalCents"]),
  { unitPriceCents: null, vatRate: null, lineTotalCents: null },
);

// Third-party viewer with empty profile.
const strangerView = projectDealView(dealView(), emptyAccess, "org-other");
eq("customer embed hidden without customer_identity", strangerView.customer, HIDDEN);
eq("buyer embed hidden for non-buyer without customer_identity", strangerView.buyer, HIDDEN);

// purchase_only keeps its own buy-side items even without supplier_identity.
const purchaseView = projectDealView(dealView("purchase_only"), emptyAccess, "org-buy");
eq(
  "purchase_only keeps buy-side items without supplier_identity",
  purchaseView.lineItems.map((i) => i.id),
  ["li-sell", "li-buy"],
);

// Supplier-visible viewer keeps the buy leg fully.
const supplierAccess = resolveFieldAccess(
  profile({
    deal_terms: { visible: true, editable: false },
    supplier_identity: { visible: true, editable: false },
  }),
);
const supplierView = projectDealView(dealView(), supplierAccess, "org-sell");
eq("buy-side items kept with supplier_identity", supplierView.lineItems.map((i) => i.id), ["li-sell", "li-buy"]);
eq("buy-side price kept with supplier_identity+deal_terms", supplierView.lineItems[1]?.unitPriceCents, 800);
eq("producer embed kept with supplier_identity", supplierView.producer.id, "org-prod");

// ── review-fix regressions ──
// [6] a seller-org viewer sees its own counterparty (buyer) even without
// customer_identity — a deal party always sees its partner.
const sellerNoIdentity = resolveFieldAccess(profile({ deal_terms: { visible: true, editable: false } }));
const sellerView = projectDealView(dealView(), sellerNoIdentity, "org-sell");
eq("seller org sees buyer embed without customer_identity", sellerView.buyer.id, "org-buy");
eq("seller org still can't see producer without supplier_identity", sellerView.producer, HIDDEN);

// [4] derived production aggregates share the production domain (no leak of
// treadM3/winderM3 back through totals) and margin for maxM3.
const noProd = resolveFieldAccess(profile({}));
eq("totalProducedM3 hidden without production", noProd.canSee("totalProducedM3"), false);
eq("wasteM3 hidden without production", noProd.canSee("wasteM3"), false);
eq("wastePercent hidden without production", noProd.canSee("wastePercent"), false);
const prodOnly = resolveFieldAccess(profile({ production: { visible: true, editable: false } }));
eq("totalProducedM3 visible with production", prodOnly.canSee("totalProducedM3"), true);

// [5] staircase cost components are margin, final price is deal_terms.
const termsNoMargin = resolveFieldAccess(profile({ deal_terms: { visible: true, editable: false } }));
eq("staircase final price visible with deal_terms", termsNoMargin.domainVisible("deal_terms"), true);
eq("staircase cost components hidden without margin", termsNoMargin.domainVisible("margin"), false);

// ── profile helpers ──
const fullAccess = resolveFieldAccess(fullAccessProfile());
eq("fullAccessProfile sees deal_terms", fullAccess.canSee("totalPricePence"), true);
eq("fullAccessProfile edits margin", fullAccess.canEdit("plTotalValue"), true);
eq("fullAccessProfile sees chain", fullAccess.domainVisible("chain"), true);
eq("fullAccessProfile scope is all", fullAccessProfile().scope, "all");
eq("fullAccessProfile grants buy-side row visibility", fullAccessProfile().dealVisibility.has("side.buy"), true);
eq("emptyAccessProfile denies deal_terms", emptyAccess.canSee("totalPricePence"), false);
eq("emptyAccessProfile has no actions", emptyAccessProfile().actions.size, 0);
eq("emptyAccessProfile scope defaults to company", emptyAccessProfile().scope, "company");

console.log(`\naccess.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
