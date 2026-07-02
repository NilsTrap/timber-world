/**
 * Merge-field + line-items registry — the SINGLE shared source of truth for the
 * compiler, the insert-field palette (W5), and the line-items column designer
 * (W5), so friendly labels and their underlying Handlebars tokens can never
 * drift apart. PURE: no react/@tiptap.
 *
 * A `token` is the Handlebars expression WITHOUT the `{{ }}` braces (the compiler
 * adds them), and carries any helper prefix, e.g. "seller.name",
 * "money totals.totalCents", "fmtDate docDate". Bindings mirror DocumentData
 * (features/orders/services/documents/types.ts) + the templateMerge helpers
 * (money, moneyCur, fmtM3, fmtDate, pct).
 */

export interface MergeFieldDef {
  /** Human label shown in the palette + on the pill. */
  label: string;
  /** Handlebars expression without braces (may include a helper prefix). */
  token: string;
}

export interface MergeFieldGroup {
  heading: string;
  items: MergeFieldDef[];
}

/** Scalar merge-fields, grouped for the insert-field menu (loops are separate blocks). */
export const MERGE_FIELD_GROUPS: MergeFieldGroup[] = [
  {
    heading: "Document",
    items: [
      { label: "Title", token: "docTitle" },
      { label: "Number", token: "docNumber" },
      { label: "Date", token: "fmtDate docDate" },
      { label: "Deal code", token: "dealCode" },
      { label: "Currency", token: "currency" },
      { label: "Notes", token: "notes" },
    ],
  },
  {
    heading: "Seller",
    items: [
      { label: "Seller name", token: "seller.name" },
      { label: "Seller reg. no", token: "seller.regNo" },
      { label: "Seller VAT no", token: "seller.vatNo" },
      { label: "Seller address", token: "seller.address" },
      { label: "Seller country", token: "seller.country" },
      { label: "Seller email", token: "seller.email" },
      { label: "Seller phone", token: "seller.phone" },
      { label: "Seller bank", token: "seller.bankName" },
      { label: "Seller account", token: "seller.bankAccount" },
      { label: "Seller SWIFT", token: "seller.bankSwift" },
    ],
  },
  {
    heading: "Buyer",
    items: [
      { label: "Buyer name", token: "buyer.name" },
      { label: "Buyer reg. no", token: "buyer.regNo" },
      { label: "Buyer VAT no", token: "buyer.vatNo" },
      { label: "Buyer address", token: "buyer.address" },
      { label: "Buyer country", token: "buyer.country" },
      { label: "Buyer email", token: "buyer.email" },
      { label: "Buyer phone", token: "buyer.phone" },
      { label: "Buyer bank", token: "buyer.bankName" },
      { label: "Buyer account", token: "buyer.bankAccount" },
      { label: "Buyer SWIFT", token: "buyer.bankSwift" },
    ],
  },
  {
    heading: "Terms",
    items: [
      { label: "Incoterms", token: "incoterms" },
      { label: "Payment terms", token: "paymentTerms" },
      { label: "Delivery terms", token: "deliveryTerms" },
      { label: "Delivery deadline", token: "deliveryDeadline" },
      { label: "Advance %", token: "pct advancePct" },
    ],
  },
  {
    heading: "Totals",
    items: [
      { label: "Total volume m³", token: "fmtM3 totals.totalVolumeM3" },
      { label: "Subtotal", token: "money totals.subtotalCents" },
      { label: "VAT rate", token: "pct totals.vatRate" },
      { label: "VAT amount", token: "money totals.vatCents" },
      { label: "Total", token: "money totals.totalCents" },
      { label: "Total (with currency)", token: "moneyCur totals.totalCents" },
      { label: "Amount in words", token: "totals.amountInWords" },
    ],
  },
];

/** Flat token → label lookup (for rendering a friendly pill label from a stored token). */
export const MERGE_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  MERGE_FIELD_GROUPS.flatMap((g) => g.items.map((i) => [i.token, i.label]))
);

export interface LineItemColumn {
  key: string;
  header: string;
  /** Item-scoped Handlebars cell expression (resolved inside {{#each lineItems}}). */
  cell: string;
  /** Right-align (numeric) → cell/header gets class="num". */
  num: boolean;
}

/** Line-items table columns — item scope (NO path prefix), one per DocLineItem field. */
export const LINE_ITEM_COLUMNS: Record<string, LineItemColumn> = {
  lineNo: { key: "lineNo", header: "#", cell: "{{lineNo}}", num: true },
  description: { key: "description", header: "Description", cell: "{{description}}", num: false },
  dimensions: { key: "dimensions", header: "Dimensions (mm)", cell: "{{dimensions}}", num: false },
  pieces: { key: "pieces", header: "Pcs", cell: "{{pieces}}", num: true },
  volumeM3: { key: "volumeM3", header: "m³", cell: "{{fmtM3 volumeM3}}", num: true },
  unit: { key: "unit", header: "Unit", cell: "{{unit}}", num: false },
  unitPriceCents: { key: "unitPriceCents", header: "Unit price", cell: "{{money unitPriceCents}}", num: true },
  lineTotalCents: { key: "lineTotalCents", header: "Total", cell: "{{money lineTotalCents}}", num: true },
};

/** Default column set + order for a new line-items table (matches the seeded layout). */
export const DEFAULT_LINE_ITEM_COLUMNS: string[] = [
  "lineNo",
  "description",
  "dimensions",
  "pieces",
  "volumeM3",
  "unitPriceCents",
  "lineTotalCents",
];

/**
 * The base data path of a token, with any helper prefix stripped — used by
 * hide-when-empty to build the {{#if PATH}} condition. Handlebars helper syntax
 * is "helper arg" (whitespace-separated), so the data path is the LAST segment:
 *   "money totals.totalCents" → "totals.totalCents"
 *   "seller.name"             → "seller.name"
 *   "fmtDate docDate"         → "docDate"
 */
export function basePathOf(token: string): string {
  const parts = token.trim().split(/\s+/);
  return parts[parts.length - 1] ?? token.trim();
}
