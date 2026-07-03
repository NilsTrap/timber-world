/**
 * The seeded document templates authored as Plate (Slate) documents. These
 * replace the raw-HTML seeds: each compiles (compiler/slate.ts) to the same kind
 * of Handlebars-HTML the originals used, so the render pipeline fills real deal
 * data — but they are now fully editable in the visual editor.
 *
 * Small builders keep them readable; merge fields are `mention` nodes whose
 * `value` is the Handlebars token, the repeating goods table is a `line_items`
 * node, side-by-side parties are a `column_group`, and optional lines carry
 * `hideWhen` so they collapse when the deal has no value.
 */
import type { SlateNode } from "./slate";
import type { DocType } from "../../orders/services/dealModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

const field = (token: string): N => ({ type: "mention", value: token, children: [{ text: "" }] });
const txt = (text: string, marks: Record<string, boolean> = {}): N => ({ text, ...marks });
const p = (children: N[], extra: Record<string, unknown> = {}): N => ({ type: "p", children, ...extra });
const pr = (children: N[]): N => ({ type: "p", align: "right", children }); // right-aligned
const heading = (n: 1 | 2 | 3, children: N[], extra: Record<string, unknown> = {}): N => ({
  type: `h${n}`,
  children,
  ...extra,
});
const hr = (): N => ({ type: "hr", children: [{ text: "" }] });
const col = (children: N[]): N => ({ type: "column", children });
const cols = (...columns: N[][]): N => ({ type: "column_group", children: columns.map(col) });
const callout = (children: N[]): N => ({ type: "callout", children });
const lineItems = (columns: string[]): N => ({ type: "line_items", columns, children: [{ text: "" }] });

/** "Label: {{token}}" line, hidden when the value is empty. */
const labeled = (label: string, token: string): N => p([txt(label + ": "), field(token)], { hideWhen: token });
/** A bare optional value line (e.g. address), hidden when empty. */
const optLine = (token: string): N => p([field(token)], { hideWhen: token });

/** A party column: heading + bold name + optional address / reg / vat lines. */
const party = (label: string, base: string): N =>
  col([
    heading(3, [txt(label)]),
    p([txt("", { bold: true }), field(`${base}.name`)]),
    optLine(`${base}.address`),
    labeled("Reg. No", `${base}.regNo`),
    labeled("VAT", `${base}.vatNo`),
  ]);

const GOODS_COLUMNS = [
  "lineNo",
  "description",
  "dimensions",
  "pieces",
  "volumeM3",
  "unitPriceCents",
  "lineTotalCents",
];

/** Totals block (right-aligned): subtotal, VAT, grand total. */
const totalsBlock = (): N[] => [
  pr([txt("Subtotal: "), field("money totals.subtotalCents"), txt(" "), field("currency")]),
  pr([txt("VAT ("), field("totals.vatRate"), txt("%): "), field("money totals.vatCents"), txt(" "), field("currency")]),
  pr([txt("Total: ", { bold: true }), field("moneyCur totals.totalCents")]),
];

/** Seller payment details box. */
const paymentBox = (): N =>
  callout([
    heading(3, [txt("Payment details")]),
    labeled("Terms", "paymentTerms"),
    labeled("Bank", "seller.bankName"),
    labeled("Account (IBAN)", "seller.bankAccount"),
    labeled("SWIFT/BIC", "seller.bankSwift"),
    p([txt("Reference: "), field("docNumber"), txt(" / Deal "), field("dealCode")]),
  ]);

/** Shared header: seller name (left) + document title (right) + meta line. */
const letterhead = (): N[] => [
  cols([heading(2, [field("seller.name")])], [heading(2, [field("docTitle")], { align: "right" })]),
  pr([field("docNumber"), txt(" · Deal "), field("dealCode"), txt(" · "), field("fmtDate docDate")]),
  hr(),
];

// ── INVOICE ────────────────────────────────────────────────────────────────
const invoice: SlateNode[] = [
  ...letterhead(),
  cols([party("Supplier", "seller")], [party("Bill to", "buyer")]),
  lineItems(GOODS_COLUMNS),
  ...totalsBlock(),
  p([txt("In words: ", { italic: true }), field("totals.amountInWords")], { hideWhen: "totals.amountInWords" }),
  paymentBox(),
  p([field("notes")], { hideWhen: "notes" }),
];

/** Slate templates keyed by DocType. (Being filled in per type; invoice first.) */
export const SLATE_TEMPLATES: Partial<Record<DocType, SlateNode[]>> = {
  invoice,
};
