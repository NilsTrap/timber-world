/**
 * Specification renderer (sales & purchase) — jsPDF + autotable.
 *
 * Pure: takes DocumentData, returns PDF bytes. No DB, no I/O — so it runs in
 * Node for unit tests and on the server for real generation. European number
 * formatting (space thousands, comma decimal) per the sample documents.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DocumentData, RenderedDocument } from "./types";

function fmtAmount(cents: number | null | undefined): string {
  if (cents == null) return "";
  const v = cents / 100;
  const [int = "0", dec = "00"] = v.toFixed(2).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSep},${dec}`;
}

function fmtM3(v: number | null | undefined): string {
  if (v == null) return "";
  const [int = "0", dec = "000"] = v.toFixed(3).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSep},${dec}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}.`;
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim();
}

export function renderSpecification(data: DocumentData): RenderedDocument {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const right = pageW - margin;
  let y = margin;

  // ── Header: seller name (left) + document title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(data.seller.name || "Seller", margin, y);
  doc.setFontSize(13);
  doc.text(data.docTitle, right, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${data.docNumber}   ·   Deal ${data.dealCode}   ·   ${fmtDate(data.docDate)}`, right, y, { align: "right" });
  y += 6;

  doc.setDrawColor(180);
  doc.line(margin, y, right, y);
  y += 6;

  // ── Parties: seller (left) / buyer (right)
  const colRightX = pageW / 2 + 5;
  const startY = y;

  const sellerLines = partyLines("Seller", data.seller, true);
  const buyerLines = partyLines(data.docType === "purchase_spec" ? "Producer" : "Buyer", data.buyer, false);

  doc.setFontSize(9);
  let ly = startY;
  for (const [i, line] of sellerLines.entries()) {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.text(line, margin, ly);
    ly += 4.5;
  }
  const sellerBottom = ly;

  ly = startY;
  for (const [i, line] of buyerLines.entries()) {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.text(line, colRightX, ly);
    ly += 4.5;
  }
  y = Math.max(sellerBottom, ly) + 3;

  // ── External refs (client codes), if any
  if (data.externalRefs.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const refStr = data.externalRefs.map((r) => `${r.label}: ${r.value}`).join("    ");
    doc.text(refStr, margin, y);
    y += 5;
  }

  // ── Terms line
  const terms: string[] = [];
  if (data.incoterms) terms.push(`Incoterms: ${data.incoterms}`);
  if (data.advancePct != null) terms.push(`Advance: ${data.advancePct}%`);
  if (data.paymentTerms) terms.push(`Payment: ${data.paymentTerms}`);
  if (data.deliveryTerms) terms.push(`Delivery: ${data.deliveryTerms}`);
  if (data.deliveryDeadline) terms.push(`Deadline: ${data.deliveryDeadline}`);
  if (terms.length > 0) {
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(terms.join("    ·    "), right - margin);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5 + 2;
  }

  // ── Line items table
  const head = [["#", "Description", "Dimensions (mm)", "Pcs", "m³", `Unit (${data.currency})`, `Total (${data.currency})`]];
  const body = data.lineItems.map((li) => [
    String(li.lineNo),
    li.description,
    li.dimensions,
    li.pieces ?? "",
    fmtM3(li.volumeM3),
    fmtAmount(li.unitPriceCents),
    fmtAmount(li.lineTotalCents),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [60, 82, 92], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, halign: "right" },
      2: { cellWidth: 32 },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Totals
  const t = data.totals;
  doc.setFontSize(9);
  const totalsX = right - 70;
  const valX = right;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: "right" });
    y += 5;
  };
  totalRow("Total volume", `${fmtM3(t.totalVolumeM3)} m³`);
  totalRow("Subtotal", `${fmtAmount(t.subtotalCents)} ${data.currency}`);
  totalRow(`VAT (${t.vatRate}%)`, `${fmtAmount(t.vatCents)} ${data.currency}`);
  totalRow("Total", `${fmtAmount(t.totalCents)} ${data.currency}`, true);
  y += 2;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const words = doc.splitTextToSize(`In words: ${t.amountInWords}.`, right - margin);
  doc.text(words, margin, y);
  y += words.length * 4 + 2;

  if (t.vatReference) {
    doc.setFont("helvetica", "normal");
    const ref = doc.splitTextToSize(t.vatReference, right - margin);
    doc.text(ref, margin, y);
    y += ref.length * 4 + 2;
  }

  // ── Notes
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    const n = doc.splitTextToSize(data.notes, right - margin);
    doc.text(n, margin, y);
    y += n.length * 4 + 2;
  }

  // ── Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text(
    `Generated by Timber World · ${data.docNumber} · Deal ${data.dealCode}`,
    margin,
    287
  );

  const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
  const title = data.docTitle.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  const fileName = sanitizeFileName(`${data.dealCode} ${title} ${data.docNumber}.pdf`);
  return { bytes, fileName, mimeType: "application/pdf" };
}

function partyLines(role: string, p: DocumentData["seller"], includeBank: boolean): string[] {
  const lines: string[] = [`${role}: ${p.name || "—"}`];
  if (p.address) lines.push(p.address);
  const ids: string[] = [];
  if (p.regNo) ids.push(`Reg: ${p.regNo}`);
  if (p.vatNo) ids.push(`VAT: ${p.vatNo}`);
  if (ids.length) lines.push(ids.join("   "));
  const contact: string[] = [];
  if (p.email) contact.push(p.email);
  if (p.phone) contact.push(p.phone);
  if (contact.length) lines.push(contact.join("   "));
  if (includeBank && (p.bankName || p.bankAccount)) {
    if (p.bankName) lines.push(`Bank: ${p.bankName}`);
    if (p.bankAccount) lines.push(`Acc: ${p.bankAccount}${p.bankSwift ? `   SWIFT: ${p.bankSwift}` : ""}`);
  }
  return lines;
}
