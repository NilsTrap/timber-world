/**
 * E4 · Field-level visibility wall — the deal-field registry + pure resolver.
 *
 * Every order/deal field maps to ONE domain; a group's profile grants
 * domains (visibility/deal_fields rights) and may override single fields
 * (field/deal rights, editable in the Groups settings UI). Resolution:
 *
 *   per-field override  ▸  else its domain grant  ▸  else:
 *     `general` is visible to anyone who can see the row; every other
 *     domain is DENY BY DEFAULT (spec §1.4).
 *
 * This replaces the three hardcoded strip sites (getOrders /
 * getOrderPackages / getStaircaseCodes) and the PRODUCTION_EDIT_FIELDS
 * write whitelist in updateOrder. Parity with the old behaviour is encoded
 * in migration 20260701000011 (legacy groups get deal_terms+margin+
 * financial_docs together iff a pricing tab was granted — the exact
 * stripOrderPricing condition).
 *
 * Pure module: no DB, no next imports — unit-tested in __tests__/.
 */

import type { AccessProfile, FieldDomain } from "@/lib/access/types";

/** How a hidden field is blanked in a projected payload (type-compatible
 * with the UI: numeric columns expect numbers, nullable columns null). */
export type BlankStrategy = "zero" | "null";

interface FieldSpec {
  domain: FieldDomain;
  blank: BlankStrategy;
}

const f = (domain: FieldDomain, blank: BlankStrategy = "null"): FieldSpec => ({ domain, blank });

/**
 * Order payload fields (camelCase, as returned by getOrders/getOrder).
 * Unlisted fields resolve to `general` — identity/audit/spec columns are
 * visible to anyone who can see the row.
 */
export const ORDER_FIELD_DOMAINS: Record<string, FieldSpec> = {
  // deal_terms — the leg's own commercial terms
  totalPricePence: f("deal_terms", "zero"),
  valueCents: f("deal_terms"),

  // margin / P&L (admin-only by seed)
  maxM3: f("margin", "zero"),
  eurPerM3: f("margin", "zero"),
  workPerPiece: f("margin", "zero"),
  invoicedWork: f("margin", "zero"),
  usedWork: f("margin", "zero"),
  invoicedTransport: f("margin", "zero"),
  usedTransport: f("margin", "zero"),
  plMaterialValue: f("margin", "zero"),
  plWorkValue: f("margin", "zero"),
  plTransportValue: f("margin", "zero"),
  plMaterialsValue: f("margin", "zero"),
  plTotalValue: f("margin", "zero"),
  plPercentFromInvoice: f("margin", "zero"),

  // financial_docs — sales/transport invoicing
  advanceInvoiceNumber: f("financial_docs"),
  invoiceNumber: f("financial_docs"),
  transportInvoiceNumber: f("financial_docs"),
  transportPrice: f("financial_docs"),

  // production — the old PRODUCTION_EDIT_FIELDS neighbourhood (production
  // invoices deliberately live here, not in financial_docs: production-tab
  // users see and edit them today)
  treadM3: f("production"),
  winderM3: f("production"),
  quarterM3: f("production"),
  usedMaterialM3: f("production", "zero"),
  // Derived aggregates that arithmetically reconstruct the produced volumes /
  // material use — must share the production domain or they leak it back.
  totalProducedM3: f("production", "zero"),
  wasteM3: f("production", "zero"),
  wastePercent: f("production", "zero"),
  productionMaterial: f("production"),
  productionWork: f("production", "zero"),
  productionFinishing: f("production"),
  productionTotal: f("production"),
  productionInvoiceNumber: f("production"),
  productionPaymentDate: f("production"),
  woodArt: f("production"),
  glowing: f("production", "zero"),
  woodArtCnc: f("production"),
  woodArtTotal: f("production"),
  woodArtInvoiceNumber: f("production"),
  woodArtPaymentDate: f("production"),

  // logistics
  packageNumber: f("logistics"),
  dateLoaded: f("logistics"),
  plannedDate: f("logistics"),

  // party identity (seller = the house/Manufacturer stays `general`: it is
  // every counterparty's own deal partner)
  customerOrganisationId: f("customer_identity"),
  customerOrganisationName: f("customer_identity"),
  customerOrganisationCode: f("customer_identity"),
  producerOrganisationId: f("supplier_identity"),
  producerOrganisationName: f("supplier_identity"),
  producerOrganisationCode: f("supplier_identity"),

  // chain linkage (admin-only by seed; spec §2.6 — parties never see the
  // spine beyond their own deal)
  spineId: f("chain"),
  upstreamDealId: f("chain"),
};

/** Package payload pricing fields (getOrderPackages / OrderProductsTable). */
export const PACKAGE_FIELD_DOMAINS: Record<string, FieldSpec> = {
  unitPricePiece: f("deal_terms"),
  unitPriceM3: f("deal_terms"),
  unitPriceM2: f("deal_terms"),
  workPerPiece: f("margin"),
  transportPerPiece: f("margin"),
  eurPerM3: f("margin"),
};

/** UK staircase pricing fields (getStaircaseCodes). The cost COMPONENTS are
 * the same economic quantities gated as `margin` on packages — classifying
 * them as deal_terms would hand a sell-side group (which has deal_terms but
 * not margin) the inputs to recompute every zeroed margin field. Only the
 * customer-facing final price is deal_terms. */
export const STAIRCASE_FIELD_DOMAINS: Record<string, FieldSpec> = {
  eurPerM3Cents: f("margin", "zero"),
  workCostCents: f("margin", "zero"),
  transportCostCents: f("margin", "zero"),
  finalPriceCents: f("deal_terms"),
};

/** Deal-view (order_line_items) pricing fields. */
export const LINE_ITEM_FIELD_DOMAINS: Record<string, FieldSpec> = {
  unitPriceCents: f("deal_terms"),
  lineTotalCents: f("deal_terms"),
  vatRate: f("deal_terms"),
};

export interface FieldAccess {
  canSee(field: string): boolean;
  canEdit(field: string): boolean;
  /** Domain-level check, for section/tab visibility. */
  domainVisible(domain: FieldDomain): boolean;
  domainEditable(domain: FieldDomain): boolean;
}

/**
 * Pure resolver: profile + registry → field access. `isAdmin` callers
 * should not call this at all (fullAccessProfile grants everything anyway).
 */
export function resolveFieldAccess(
  profile: AccessProfile,
  registry: Record<string, FieldSpec> = ORDER_FIELD_DOMAINS,
): FieldAccess {
  const domainVisible = (domain: FieldDomain): boolean => {
    const grant = profile.fieldDomains[domain];
    if (grant) return grant.visible;
    return domain === "general";
  };
  const domainEditable = (domain: FieldDomain): boolean => {
    const grant = profile.fieldDomains[domain];
    if (grant) return grant.visible && grant.editable;
    return false;
  };
  const canSee = (field: string): boolean => {
    const override = profile.fieldOverrides[field];
    if (override) return override.visible;
    return domainVisible(registry[field]?.domain ?? "general");
  };
  const canEdit = (field: string): boolean => {
    const override = profile.fieldOverrides[field];
    if (override) return override.visible && override.editable;
    return domainEditable(registry[field]?.domain ?? "general");
  };
  return { canSee, canEdit, domainVisible, domainEditable };
}

/**
 * Project a payload through the wall: hidden fields are blanked per the
 * registry's strategy ("zero" keeps numeric columns rendering, "null"
 * empties nullable ones). Fields not in the registry are left untouched
 * (general). Returns a shallow copy.
 */
export function projectFields<T extends object>(
  payload: T,
  access: FieldAccess,
  registry: Record<string, FieldSpec>,
): T {
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const [field, spec] of Object.entries(registry)) {
    if (field in out && !access.canSee(field)) {
      out[field] = spec.blank === "zero" ? 0 : null;
    }
  }
  return out as T;
}

/**
 * Write guard: which of the submitted fields is the caller NOT allowed to
 * edit (replaces the PRODUCTION_EDIT_FIELDS whitelist). Only defined
 * (non-undefined) keys count as submitted.
 */
export function disallowedEdits(
  input: Record<string, unknown>,
  access: FieldAccess,
): string[] {
  return Object.entries(input)
    .filter(([key, value]) => value !== undefined && !access.canEdit(key))
    .map(([key]) => key);
}

// ---------------------------------------------------------------------------
// Deal-view projection (the Deal tab payload)

interface DealPartyRef {
  id: string | null;
  code: string | null;
  name: string | null;
}

interface DealViewLike {
  dealKind: string;
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  transportBilling: string;
  customer: DealPartyRef;
  seller: DealPartyRef;
  producer: DealPartyRef;
  buyer: DealPartyRef;
  spineId: string | null;
  upstreamDealId: string | null;
  lineItems: Array<{
    side: string;
    unitPriceCents: number | null;
    vatRate: number | null;
    lineTotalCents: number | null;
  }>;
}

const HIDDEN_PARTY: DealPartyRef = { id: null, code: null, name: null };

/**
 * Project a deal view through the wall (pure; generic so the concrete
 * OrderDealView flows through unchanged):
 * - chain linkage (spineId/upstreamDealId) → `chain` domain
 * - commercial terms + line-item prices → `deal_terms`
 * - customer embed → `customer_identity`; buyer embed is the same identity
 *   on legacy rows (buyer == customer), so it follows the same domain unless
 *   the viewer IS the buyer org
 * - producer embed → `supplier_identity`
 * - buy-side line items on a conflated legacy `buy_sell` row are the
 *   upstream purchase (supplier pricing) → dropped without
 *   `supplier_identity`; on single-sided deals items are the deal's own
 *   terms and stay
 * The seller embed stays: it is every counterparty's own deal partner.
 */
export function projectDealView<T extends DealViewLike>(
  view: T,
  access: FieldAccess,
  viewerOrgId: string | null,
): T {
  const seeTerms = access.domainVisible("deal_terms");
  const seeChain = access.domainVisible("chain");
  const seeCustomer = access.domainVisible("customer_identity");
  const seeSupplier = access.domainVisible("supplier_identity");

  const lineItems = view.lineItems
    .filter((item) => item.side !== "buy" || view.dealKind !== "buy_sell" || seeSupplier)
    .map((item) =>
      seeTerms ? item : { ...item, unitPriceCents: null, vatRate: null, lineTotalCents: null },
    );

  return {
    ...view,
    incoterms: seeTerms ? view.incoterms : null,
    incotermsPlace: seeTerms ? view.incotermsPlace : null,
    advancePct: seeTerms ? view.advancePct : null,
    paymentTerms: seeTerms ? view.paymentTerms : null,
    deliveryTerms: seeTerms ? view.deliveryTerms : null,
    customer: seeCustomer ? view.customer : HIDDEN_PARTY,
    producer: seeSupplier ? view.producer : HIDDEN_PARTY,
    // A deal party always sees its own counterparty: the buyer embed is shown
    // to anyone with customer_identity, OR to the buyer org itself, OR to the
    // seller org (on bilateral purchase/production legs the seller is the
    // supplier/producer login and the buyer is the house — its own partner).
    buyer:
      seeCustomer ||
      (viewerOrgId !== null &&
        (view.buyer.id === viewerOrgId || view.seller.id === viewerOrgId))
        ? view.buyer
        : HIDDEN_PARTY,
    spineId: seeChain ? view.spineId : null,
    upstreamDealId: seeChain ? view.upstreamDealId : null,
    lineItems,
  };
}
