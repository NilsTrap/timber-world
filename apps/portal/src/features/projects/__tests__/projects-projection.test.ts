/**
 * Timber Projects — persona + payload-redaction tests (pure, no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/projects/__tests__/projects-projection.test.ts`
 *
 * These run the REAL pipeline the loaders run — projectDealView (the E4 field
 * wall) followed by the Projects projectors — for one deal seen through five
 * different access profiles. What they assert is not "the UI hides it" but
 * "the key is not in the payload": a hidden counterparty, price, margin, chain
 * id or sibling fact must be impossible to read off the serialized object.
 */
import { projectDealView, resolveFieldAccess } from "../../orders/services/dealFields";
import {
  type AccessProfile,
  type FieldDomain,
  type FieldGrant,
  fullAccessProfile,
  emptyAccessProfile,
} from "@/lib/access/types";
import { personasForOrg, orgRoleFlagsFromRow, PERSONA_LABEL } from "../personas";
import {
  toProjectDetail,
  toProjectListItem,
  resolveProjectSpineLabel,
  type DealHeaderLike,
  type DealLineComponentLike,
  type DealLineLike,
  type DealProcessRequirementLike,
  type ProjectionContext,
} from "../projection";
import { summariseFileCounts } from "../services/projectFiles";
import type { ProjectFileMeta } from "../types";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, cond: boolean, extra?: unknown) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`, extra !== undefined ? JSON.stringify(extra) : ""); }
}

/** Inline AccessProfile builder (same shape as the E4 access tests). */
function profile(fieldDomains: Partial<Record<FieldDomain, FieldGrant>>): AccessProfile {
  return { ...emptyAccessProfile(), fieldDomains };
}
const SEE = { visible: true, editable: false };

// ── Personas ────────────────────────────────────────────────────────────────
eq("is_customer → buyer", personasForOrg({ isCustomer: true }), ["buyer"]);
eq("is_trader → trader", personasForOrg({ isTrader: true }), ["trader"]);
eq("is_supplier → supplier", personasForOrg({ isSupplier: true }), ["supplier"]);
eq("is_manufacturer → supplier", personasForOrg({ isManufacturer: true }), ["supplier"]);
eq("is_producer → supplier", personasForOrg({ isProducer: true }), ["supplier"]);
eq("supplier is emitted once even with all three flags",
   personasForOrg({ isSupplier: true, isManufacturer: true, isProducer: true }), ["supplier"]);
eq("multi-role keeps the stable order",
   personasForOrg({ isProducer: true, isTrader: true, isCustomer: true }), ["buyer", "trader", "supplier"]);
eq("no flags → no persona at all", personasForOrg({}), []);
eq("null flags → no persona at all", personasForOrg(null), []);
eq("unreadable org row → no persona", personasForOrg(orgRoleFlagsFromRow(null)), []);
eq("row mapping reads the snake_case columns",
   personasForOrg(orgRoleFlagsFromRow({ is_customer: true, is_trader: false, is_producer: true })),
   ["buyer", "supplier"]);
eq("labels are presentation strings", PERSONA_LABEL.supplier, "Supplier / Manufacturer");

// ── Fixture: one bilateral deal, house (seller) → client (buyer), Wood ART producer
const SELLER = "org-sell", BUYER = "org-buy", PRODUCER = "org-prod", CUSTOMER = "org-buy";
const OUTSIDER = "org-other";

function line(over: Partial<DealLineLike> = {}): DealLineLike {
  return {
    id: "li-1", side: "sell", lineNo: 1, productName: "Oak board", woodSpecies: "Oak",
    humidity: "8-10%", processing: "planed", quality: "A", thickness: "20", width: "120",
    length: "2000", pieces: "50", volumeM3: 2.4, unit: "m3",
    unitPriceCents: 120000, vatRate: 21, lineTotalCents: 288000, catalogProductId: null, ...over,
  };
}

/**
 * The fixture deliberately carries EVERY dangerous field the real `orders` row
 * carries — spine/chain pointers, the margin-approval stamp, generated
 * documents with storage paths and an Oscar URL, external refs. If a projector
 * ever spreads its input instead of building an allow-list, these show up in
 * the payload and the negative assertions below fail. A fixture without them
 * would make those assertions vacuous.
 */
function deal() {
  return {
    id: "deal-1", code: "ORD-042", dealCode: "TWP-CLI-0007", name: "Staircase batch",
    dealKind: "buy_sell", currency: "EUR", valueCents: 345600, status: "confirmed", lifecycleStage: "confirmed",
    incoterms: "FOB", incotermsPlace: "Riga", advancePct: 30, paymentTerms: "30 days",
    deliveryTerms: "DAP site", deliveryDeadline: "2026-09-01", transportBilling: "in_price",
    notes: "Handle with care",
    sellerSigneeName: "A. Seller", sellerSigneeRole: "Director",
    buyerSigneeName: "B. Buyer", buyerSigneeRole: "Owner",
    customer: { id: CUSTOMER, code: "CLI", name: "Client Org" },
    seller: { id: SELLER, code: "TWP", name: "Timber World" },
    producer: { id: PRODUCER, code: "WRT", name: "Wood ART" },
    buyer: { id: BUYER, code: "CLI", name: "Client Org" },
    spineId: "spine-1", spineCode: "SP-014", upstreamDealId: "deal-0",
    marginApprovedAt: "2026-08-10T09:00:00Z",
    plTotalValue: 123456, eurPerM3: 420, invoicedWork: 999,
    externalRefs: [{ id: "ref-1", refType: "client_project", refValue: "CLIENT-PO-88" }],
    documents: [{
      id: "doc-1", docType: "invoice", docNumber: "INV-2026-0001",
      storagePath: "deal-1/invoice/secret.pdf", oscarDocUrl: "https://oscar.example/doc/1",
    }],
    lineItems: [line(), line({ id: "li-2", side: "buy", lineNo: 2, unitPriceCents: 90000, lineTotalCents: 216000 })],
  };
}

const PERSONAS = new Map([
  [SELLER, personasForOrg({ isTrader: true })],
  [BUYER, personasForOrg({ isCustomer: true })],
  [PRODUCER, personasForOrg({ isProducer: true, isSupplier: true })],
]);

// Extra columns on purpose: the projector must copy the six safe ones and drop
// the rest, so `storage_path` cannot ride along even if a service starts
// selecting it.
const FILES = [
  {
    id: "f1", fileName: "drawing.pdf", relativePath: "drawings/final/drawing.pdf", mimeType: "application/pdf",
    fileSizeBytes: 1024, createdAt: "2026-08-01T10:00:00Z",
    lifecycleStatus: "ready",
    storagePath: "deal-1/customer/abc_drawing.pdf",
    storage_path: "deal-1/customer/abc_drawing.pdf",
    signedUrl: "https://storage.example/signed?token=xyz",
    uploadedBy: "user-1",
  },
] as unknown as ProjectFileMeta[];
const COUNTS = { total: 1 };
const COMPONENTS: DealLineComponentLike[] = [{
  id: "component-1", orderLineItemId: "li-1", type: "process", name: "Cutting",
  quantity: 207.73, unit: "kg", unitCost: 0.39, totalCostCents: 8101,
}];
const PROCESS_REQUIREMENTS: DealProcessRequirementLike[] = [{
  id: "process-1", orderLineItemId: "li-1", fieldKey: "cutting",
  name: "Cutting", value: "12", unit: "mm", active: true,
}];

/** Run the real pipeline: field wall → projectors. */
function render(p: AccessProfile, viewerOrgId: string | null, isPlatformAdmin = false) {
  const access = resolveFieldAccess(p);
  const raw = deal();
  const walled = projectDealView(deal(), access, viewerOrgId) as unknown as DealHeaderLike & {
    lineItems: DealLineLike[];
  };
  const ctx: ProjectionContext = {
    access, viewerOrgId, isPlatformAdmin, personasByOrgId: PERSONAS,
  };
  const rawHeader = raw as unknown as DealHeaderLike;
  return {
    item: toProjectListItem(rawHeader, walled, ctx, COUNTS.total),
    detail: toProjectDetail(rawHeader, walled, ctx, {
      lines: walled.lineItems ?? [], lineComponents: COMPONENTS, processRequirements: PROCESS_REQUIREMENTS,
      files: FILES, folders: [], fileCounts: COUNTS,
    }),
  };
}

// Profiles mirroring the seeded personas.
const ADMIN = fullAccessProfile();
const SALES = profile({ deal_terms: SEE, customer_identity: SEE });       // house salesperson
const PURCHASING = profile({ deal_terms: SEE, supplier_identity: SEE });  // house purchasing
const CLIENT = emptyAccessProfile();                                      // counterparty login

// ── Platform admin ──────────────────────────────────────────────────────────
const admin = render(ADMIN, null, true);
eq("admin: reference presents buyer before seller", admin.item.reference, "CLI-TWP-0007");
eq("admin: stage label comes from the shared §12 source", admin.item.stageLabel, "Confirmed");
eq("admin: currency is serialized", admin.item.currency, "EUR");
eq("admin: counterparty resolves to the buyer on a sell-shaped deal", admin.item.counterparty?.name, "Client Org");
eq("admin: counterparty carries persona labels", admin.item.counterparty?.personas, ["buyer"]);
ok("admin: terms are present", !!admin.detail.terms);
eq("admin: line prices are serialized", admin.detail.lines[0]?.unitPriceCents, 120000);
eq("admin: internal cost components are serialized", admin.detail.lines[0]?.components?.[0]?.name, "Cutting");
ok("admin: sees the producer among the other parties",
   admin.detail.otherParties.some((p) => p.id === PRODUCER), admin.detail.otherParties);

// ── House salesperson: deal_terms + customer_identity, viewer IS the seller ──
const sales = render(SALES, SELLER);
eq("salesperson: direction is sell", sales.item.direction, "sell");
eq("salesperson: counterparty is the client", sales.item.counterparty?.name, "Client Org");
ok("salesperson: keeps prices", sales.detail.lines[0]?.unitPriceCents === 120000);
ok("salesperson: NO producer/supplier party is serialized",
   !sales.detail.otherParties.some((p) => p.id === PRODUCER), sales.detail.otherParties);
ok("salesperson: their own org is not listed as a party",
   !sales.detail.otherParties.some((p) => p.id === SELLER), sales.detail.otherParties);
eq("salesperson: the residual legacy buy line is dropped (supplier pricing)",
   sales.detail.lines.length, 1);

// ── House purchasing: supplier_identity, NO customer_identity ────────────────
const purchasing = render(PURCHASING, SELLER);
ok("purchasing: sees the supplier/producer",
   purchasing.detail.otherParties.some((p) => p.id === PRODUCER));
ok("purchasing: the customer is NOT listed as a third party (no customer_identity)",
   !purchasing.detail.otherParties.some((p) => p.role === "customer"),
   purchasing.detail.otherParties);
// Honest note: this deal is a SELL leg of the purchasing user's own org, so the
// buyer IS their org's transaction partner and §9.2 shows it as `counterparty`.
// In practice a purchasing group carries no `side.sell` deal visibility, so RLS
// never returns such a row to them. The realistic case is the BUY leg below.
eq("purchasing on a sell leg: the partner is still the deal's own counterparty",
   purchasing.item.counterparty?.name, "Client Org");

// A realistic purchasing view: the house BUYS from the supplier, so the deal's
// seller is the supplier and the house is the buyer. No customer exists on it.
const buyLegRender = (() => {
  const access = resolveFieldAccess(PURCHASING);
  const raw = { ...deal(), dealKind: "purchase_only",
    seller: { id: PRODUCER, code: "WRT", name: "Wood ART" },
    buyer: { id: SELLER, code: "TWP", name: "Timber World" },
    customer: { id: null, code: null, name: null } };
  const walled = projectDealView({ ...raw }, access, SELLER) as unknown as DealHeaderLike & {
    lineItems: DealLineLike[];
  };
  const ctx: ProjectionContext = {
    access, viewerOrgId: SELLER, isPlatformAdmin: false, personasByOrgId: PERSONAS,
  };
  const rawHeader = raw as unknown as DealHeaderLike;
  return {
    item: toProjectListItem(rawHeader, walled, ctx, 0),
    detail: toProjectDetail(rawHeader, walled, ctx, { lines: walled.lineItems ?? [], files: [], folders: [], fileCounts: { total: 0 } }),
  };
})();
eq("purchasing on a BUY leg: direction is buy", buyLegRender.item.direction, "buy");
eq("purchasing on a BUY leg: the counterparty is the supplier",
   buyLegRender.item.counterparty?.name, "Wood ART");
ok("purchasing on a BUY leg: no client name appears anywhere in the payload",
   !JSON.stringify(buyLegRender).includes("Client Org"), JSON.stringify(buyLegRender).slice(0, 300));

// ── Counterparty (client) login: empty profile, viewer IS the buyer ──────────
const client = render(CLIENT, BUYER);
const clientWalledDeal = projectDealView(deal(), resolveFieldAccess(CLIENT), BUYER);
eq("client: raw spine identity remains redacted by the field wall", clientWalledDeal.spineId, null);
eq("client: direction is buy", client.item.direction, "buy");
eq("client: reference presents buyer before seller", client.item.reference, "CLI-TWP-0007");
eq("client: still sees their OWN deal partner (the seller)", client.item.counterparty?.name, "Timber World");
ok("client: no currency key at all", !("currency" in client.item), Object.keys(client.item));
ok("client: no terms key at all", !("terms" in client.detail), Object.keys(client.detail));
ok("client: line rows carry NO price keys",
   client.detail.lines.length > 0 &&
   !("unitPriceCents" in client.detail.lines[0]!) && !("lineTotalCents" in client.detail.lines[0]!),
   Object.keys(client.detail.lines[0] ?? {}));
ok("client: internal cost components are absent",
   !("components" in client.detail.lines[0]!), Object.keys(client.detail.lines[0] ?? {}));
eq("client: price-free process snapshots remain visible",
   client.detail.lines[0]?.processRequirements,
   [{ id: "process-1", fieldKey: "cutting", name: "Cutting", value: "12", unit: "mm", fieldType: "number", required: false, active: true }]);
ok("client: process snapshots never acquire commercial fields",
   Object.keys(client.detail.lines[0]?.processRequirements[0] ?? {}).every((key) =>
     ["id", "fieldKey", "name", "value", "unit", "fieldType", "required", "active"].includes(key)));
ok("client: the producer is not serialized at all",
   !client.detail.otherParties.some((p) => p.id === PRODUCER), client.detail.otherParties);
ok("client: no third party of any kind is serialized",
   client.detail.otherParties.length === 0, client.detail.otherParties);
eq("client: file metadata still comes through", client.detail.files.length, 1);

// ── A viewer who is party to neither leg and is not an admin ─────────────────
const outsider = render(CLIENT, OUTSIDER);
eq("non-party non-admin: NO counterparty is inferred", outsider.item.counterparty, null);
eq("non-party non-admin: no parties at all", outsider.detail.otherParties, []);

// ── Chain / margin / storage never serialized (any profile) ──────────────────
for (const [label, rendered] of [
  ["admin", admin], ["salesperson", sales], ["purchasing", purchasing], ["client", client],
] as const) {
  const blob = JSON.stringify(rendered.detail) + JSON.stringify(rendered.item);
  ok(`${label}: no upstream chain pointer anywhere in the payload`,
     !/upstream/i.test(blob), blob.slice(0, 200));
  ok(`${label}: no margin or P&L field anywhere in the payload`,
     !/margin|plTotal|eurPerM3|invoicedWork|usedWork/i.test(blob));
  ok(`${label}: no storage path or URL on file metadata`,
     !/storage_path|storagePath|signedUrl|http/i.test(blob));
  ok(`${label}: no order documents are serialized`, !/docType|doc_number|oscarDoc/i.test(blob));
}

// ── The payload is an allow-list, not a spread ───────────────────────────────
const ITEM_KEYS = ["id", "rowKind", "reference", "name", "spineCode", "groupKey", "depth", "stage", "stageLabel", "direction", "counterparty",
  "buyer", "seller", "deliveryDeadline", "fileCount", "currency", "valueCents"];
const DETAIL_KEYS = [...ITEM_KEYS, "displaySpineCode", "otherParties", "terms", "lines", "files", "officialImages", "folders", "fileCounts", "notes"];
ok("list item keys ⊆ whitelist", Object.keys(admin.item).every((k) => ITEM_KEYS.includes(k)),
   Object.keys(admin.item));
ok("detail keys ⊆ whitelist", Object.keys(admin.detail).every((k) => DETAIL_KEYS.includes(k)),
   Object.keys(admin.detail));
ok("detail projector does not invent a canonical spine label", !("displaySpineCode" in admin.detail));
eq("admin linked legs use the persisted spine code", resolveProjectSpineLabel("spine-1", "SP-014", "TIM-BUY-001", true), "SP-014");
eq("missing readable spine rows fall back to the deal reference", resolveProjectSpineLabel("spine-1", null, "TIM-BUY-001", true), "TIM-BUY-001");
eq("unlinked admin deals keep a stable reference fallback", resolveProjectSpineLabel(null, null, "ORD-042", true), "ORD-042");
eq("restricted viewers receive no fallback chain identity", resolveProjectSpineLabel(null, null, "ORD-042", false), undefined);
ok("party refs expose only id/name/code/personas/role",
   Object.keys(admin.item.counterparty ?? {}).every((k) =>
     ["id", "name", "code", "personas", "role"].includes(k)));
ok("vatRate is never serialized, not even for an admin",
   !JSON.stringify(admin.detail).includes("vatRate"));
ok("file metadata exposes only safe workspace and cleanup presentation columns",
   Object.keys(admin.detail.files[0] ?? {}).every((k) =>
     ["id", "fileName", "relativePath", "mimeType", "fileSizeBytes", "lifecycleStatus", "createdAt", "cleanupStatus", "cleanFileId", "wasCleaned", "cleanupFindingsCount", "shared", "sharedInbound", "officialImagePosition", "previewUrl"].includes(k)));

// ── File counts: a hidden leg's files are never attributed ───────────────────
const rows = [
  { order_id: "deal-1", category: "customer" },
  { order_id: "deal-1", category: "project" },
  { order_id: "deal-hidden", category: "project" }, // a leg this viewer cannot see
  { order_id: "deal-hidden", category: "customer" },
];
const counts = summariseFileCounts(rows, ["deal-1"]);
eq("hidden-leg rows are discarded", counts.get("deal-1"),
   { total: 1 });
eq("legacy file categories are not Projects workspace rows", counts.get("deal-1"), { total: 1 });
ok("the hidden leg gets no entry at all", !counts.has("deal-hidden"));
eq("a visible deal with no files still gets a zeroed entry",
   summariseFileCounts([], ["deal-2"]).get("deal-2"), { total: 0 });
eq("no visible ids → empty map", summariseFileCounts(rows, []).size, 0);

console.log(`\nprojects-projection.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
