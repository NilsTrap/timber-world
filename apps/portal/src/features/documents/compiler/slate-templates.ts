/**
 * The seeded document templates authored as Plate (Slate) documents. These
 * replace the raw-HTML seeds: each compiles (compiler/slate.ts) to the same kind
 * of Handlebars-HTML the originals used, so the render pipeline fills real deal
 * data — but they are now fully editable in the visual editor.
 *
 * Small builders keep them readable; merge fields are `mention` nodes whose
 * `value` is the Handlebars token, the repeating goods table is a `line_items`
 * node, side-by-side parties are a `column_group`, optional lines carry
 * `hideWhen` so they collapse when the deal has no value, and the payment box is
 * a `callout`.
 */
import type { SlateNode } from "./slate";
import type { DocType } from "../../orders/services/dealModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

const field = (token: string): N => ({ type: "mention", value: token, children: [{ text: "" }] });
const txt = (text: string, marks: Record<string, boolean> = {}): N => ({ text, ...marks });
const p = (children: N[], extra: Record<string, unknown> = {}): N => ({ type: "p", children, ...extra });
const pr = (children: N[]): N => ({ type: "p", align: "right", children });
const heading = (n: 1 | 2 | 3, children: N[], extra: Record<string, unknown> = {}): N => ({ type: `h${n}`, children, ...extra });
const hr = (): N => ({ type: "hr", children: [{ text: "" }] });
const col = (children: N[]): N => ({ type: "column", children });
const cols = (...columns: N[][]): N => ({ type: "column_group", children: columns.map(col) });
const callout = (children: N[]): N => ({ type: "callout", children });
const lineItems = (columns: string[]): N => ({ type: "line_items", columns, children: [{ text: "" }] });

/** "Label: {{token}}" line, hidden when the value is empty. */
const labeled = (label: string, token: string): N => p([txt(label + ": "), field(token)], { hideWhen: token });
/** A bare optional value line (e.g. address), hidden when empty. */
const optLine = (token: string): N => p([field(token)], { hideWhen: token });

/** A party column's blocks: heading + name + optional address/reg/vat (+ contact + bank). */
const party = (label: string, base: string, opts: { contact?: boolean; bank?: boolean } = {}): N[] => [
  heading(3, [txt(label)]),
  p([field(`${base}.name`)]),
  optLine(`${base}.address`),
  labeled("Reg. No", `${base}.regNo`),
  labeled("VAT", `${base}.vatNo`),
  ...(opts.contact ? [optLine(`${base}.email`), optLine(`${base}.phone`)] : []),
  ...(opts.bank
    ? [labeled("Bank", `${base}.bankName`), labeled("Account", `${base}.bankAccount`), labeled("SWIFT", `${base}.bankSwift`)]
    : []),
];

const GOODS = ["lineNo", "description", "dimensions", "pieces", "volumeM3", "unitPriceCents", "lineTotalCents"];
const PACKING = ["lineNo", "description", "dimensions", "pieces", "volumeM3"];

/** The "Terms" block — each line collapses when empty. */
const termsBlock = (): N[] => [
  labeled("Incoterms", "incoterms"),
  labeled("Payment", "paymentTerms"),
  labeled("Delivery", "deliveryTerms"),
  labeled("Deadline", "deliveryDeadline"),
];

/** Right-aligned totals: optional volume, subtotal, VAT, grand total. */
const totalsBlock = (opts: { volume?: boolean; grandLabel?: string } = {}): N[] => [
  ...(opts.volume ? [pr([txt("Total volume: "), field("fmtM3 totals.totalVolumeM3"), txt(" m³")])] : []),
  pr([txt("Subtotal: "), field("money totals.subtotalCents"), txt(" "), field("currency")]),
  pr([txt("VAT ("), field("totals.vatRate"), txt("%): "), field("money totals.vatCents"), txt(" "), field("currency")]),
  pr([txt((opts.grandLabel ?? "Total") + ": ", { bold: true }), field("moneyCur totals.totalCents")]),
];

/** Seller payment-details box. */
const paymentBox = (): N =>
  callout([
    heading(3, [txt("Payment details")]),
    labeled("Terms", "paymentTerms"),
    labeled("Bank", "seller.bankName"),
    labeled("Account (IBAN)", "seller.bankAccount"),
    labeled("SWIFT/BIC", "seller.bankSwift"),
    p([txt("Reference: "), field("docNumber"), txt(" / Deal "), field("dealCode")]),
  ]);

/** Two signature columns. */
const signatures = (leftLabel: string, leftBase: string, rightLabel: string, rightBase: string): N =>
  cols(
    [heading(3, [txt(leftLabel)]), p([field(`${leftBase}.name`)]), p([txt("")]), p([txt("_____________________________")]), p([txt("Signature / date", { italic: true })])],
    [heading(3, [txt(rightLabel)]), p([field(`${rightBase}.name`)]), p([txt("")]), p([txt("_____________________________")]), p([txt("Signature / date", { italic: true })])],
  );

/** A numbered contract clause: heading + body paragraphs. */
const clause = (num: number, title: string, children: N[]): N[] => [heading(3, [txt(`${num}. ${title}`)]), ...children];

/** Header: seller name (left) + document title (right) + meta line + rule. */
const letterhead = (): N[] => [
  cols([heading(2, [field("seller.name")])], [heading(2, [field("docTitle")], { align: "right" })]),
  pr([field("docNumber"), txt(" · Deal "), field("dealCode"), txt(" · "), field("fmtDate docDate")]),
  hr(),
];

const notesBlock = (): N => p([field("notes")], { hideWhen: "notes" });

// ── Templates ────────────────────────────────────────────────────────────────
const salesSpec: SlateNode[] = [
  ...letterhead(),
  cols(party("Seller", "seller", { contact: true, bank: true }), party("Buyer", "buyer", { contact: true })),
  heading(3, [txt("Terms")]),
  ...termsBlock(),
  heading(3, [txt("Goods")]),
  lineItems(GOODS),
  ...totalsBlock({ volume: true }),
  heading(3, [txt("Notes")]),
  notesBlock(),
  signatures("Seller", "seller", "Buyer", "buyer"),
];

const purchaseSpec: SlateNode[] = [
  ...letterhead(),
  cols(party("Buyer", "seller", { contact: true, bank: true }), party("Supplier", "buyer", { contact: true })),
  heading(3, [txt("Terms")]),
  ...termsBlock(),
  heading(3, [txt("Goods")]),
  lineItems(GOODS),
  ...totalsBlock({ volume: true }),
  heading(3, [txt("Notes")]),
  notesBlock(),
  signatures("Buyer", "seller", "Supplier", "buyer"),
];

const contract: SlateNode[] = [
  ...letterhead(),
  cols(party("Seller", "seller", { contact: true, bank: true }), party("Buyer", "buyer", { contact: true })),
  ...clause(1, "Subject of the contract", [
    p([txt("The Seller sells and the Buyer buys the timber goods specified in the schedule below, on the terms set out in this contract.")]),
  ]),
  ...clause(2, "Price and total value", [
    p([txt("Prices are stated in "), field("currency"), txt(" per the schedule. The total contract value is "), field("moneyCur totals.totalCents"), txt(" including VAT at "), field("totals.vatRate"), txt("% ("), field("money totals.vatCents"), txt(" "), field("currency"), txt("). In words: "), field("totals.amountInWords"), txt(".")]),
  ]),
  ...clause(3, "Payment terms", [labeled("Terms", "paymentTerms")]),
  ...clause(4, "Delivery", [labeled("Incoterms", "incoterms"), labeled("Delivery", "deliveryTerms"), labeled("Deadline", "deliveryDeadline")]),
  ...clause(5, "Schedule of goods", [lineItems(GOODS), ...totalsBlock({ grandLabel: "Total" })]),
  ...clause(6, "Additional terms", [notesBlock()]),
  signatures("Seller", "seller", "Buyer", "buyer"),
];

const proformaInvoice: SlateNode[] = [
  ...letterhead(),
  cols(party("Supplier", "seller"), party("Bill to", "buyer")),
  lineItems(GOODS),
  ...totalsBlock({ grandLabel: "Total due" }),
  p([txt("In words: ", { italic: true }), field("totals.amountInWords")], { hideWhen: "totals.amountInWords" }),
  paymentBox(),
  notesBlock(),
];

const invoice: SlateNode[] = [
  ...letterhead(),
  cols(party("Supplier", "seller"), party("Bill to", "buyer")),
  lineItems(GOODS),
  ...totalsBlock({ grandLabel: "Total due" }),
  p([txt("In words: ", { italic: true }), field("totals.amountInWords")], { hideWhen: "totals.amountInWords" }),
  paymentBox(),
  notesBlock(),
];

const packingList: SlateNode[] = [
  ...letterhead(),
  cols(party("Shipper", "seller", { contact: true }), party("Consignee", "buyer", { contact: true })),
  heading(3, [txt("Terms")]),
  ...termsBlock(),
  heading(3, [txt("Packing")]),
  lineItems(PACKING),
  ...totalsBlock({ volume: true, grandLabel: "Total" }),
  heading(3, [txt("Notes")]),
  notesBlock(),
  signatures("Shipper", "seller", "Consignee", "buyer"),
];

const cmr: SlateNode[] = [
  ...letterhead(),
  cols(party("Sender", "seller", { contact: true }), party("Consignee", "buyer", { contact: true })),
  heading(3, [txt("Terms")]),
  ...termsBlock(),
  heading(3, [txt("Goods")]),
  lineItems(PACKING),
  ...totalsBlock({ volume: true, grandLabel: "Total" }),
  heading(3, [txt("Notes")]),
  notesBlock(),
  signatures("Sender", "seller", "Carrier", "buyer"),
];

/** Slate templates keyed by DocType. */
export const SLATE_TEMPLATES: Record<DocType, SlateNode[]> = {
  sales_spec: salesSpec,
  purchase_spec: purchaseSpec,
  contract,
  proforma_invoice: proformaInvoice,
  invoice,
  packing_list: packingList,
  cmr,
};
