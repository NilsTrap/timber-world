"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml } from "@/lib/print";
import { DocumentPreviewIframe } from "./DocumentPreviewIframe";
import { getShipmentPrintData, type OrgPrintInfo } from "../actions/getShipmentPrintData";
import type { PackageDetail } from "../types";

interface PrintPackingListButtonProps {
  shipmentId: string;
  shipmentCode: string;
  shipmentDate: string;
  packages: PackageDetail[];
}

function fmtVol(vol: number | null): string {
  if (vol === null || vol === 0) return "";
  return vol.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function orgHeaderHtml(org: OrgPrintInfo): string {
  if (org.logoUrl) {
    return `<img src="${org.logoUrl}" style="max-height:70px;max-width:280px;object-fit:contain;display:block;margin:0 auto;" />`;
  }
  return `<div style="font-size:24px;font-weight:bold;text-align:center;letter-spacing:1px;">${org.name.toUpperCase()}</div>`;
}

function infoRow(label: string, value: string, bold = true): string {
  return `<tr>
    <td class="info-label">${label}</td>
    <td class="info-value${bold ? " bold" : ""}">${value}</td>
  </tr>`;
}

/** Build delivery text from org's default delivery address */
function buildDefaultDelivery(org: OrgPrintInfo): string | null {
  if (org.deliveryAddresses.length === 0) return null;
  const addr = org.deliveryAddresses.find((a) => a.isDefault) ?? org.deliveryAddresses[0]!;
  const parts = [addr.address];
  if (addr.contactName) parts.push(addr.contactName);
  if (addr.contactPhone) parts.push(addr.contactPhone);
  if (addr.contactHours) parts.push(addr.contactHours);
  return parts.join("\n");
}

function buildPackingListHtml(
  shipmentCode: string,
  shipmentDate: string,
  packages: PackageDetail[],
  from: OrgPrintInfo,
  to: OrgPrintInfo,
  deliveryFromText: string | null,
  deliveryToText: string | null
): string {
  const totalVolume = packages.reduce((s, p) => s + (p.volumeM3 ?? 0), 0);

  // Resolve delivery texts — fall back to org's default delivery address
  const resolvedDeliveryFrom = deliveryFromText || buildDefaultDelivery(from);
  const resolvedDeliveryTo = deliveryToText || buildDefaultDelivery(to);

  // Build supplier info rows
  const supplierRows: string[] = [];
  supplierRows.push(infoRow("Supplier", from.name));
  if (from.legalAddress) supplierRows.push(infoRow("Legal address", from.legalAddress));
  if (from.registrationNumber) supplierRows.push(infoRow("Reg. No.", from.registrationNumber));
  if (from.vatNumber) supplierRows.push(infoRow("VAT reg. No.", from.vatNumber));
  if (resolvedDeliveryFrom) supplierRows.push(infoRow("Delivery from", resolvedDeliveryFrom.replace(/\n/g, ". ")));

  // Build buyer info rows
  const buyerRows: string[] = [];
  buyerRows.push(infoRow("Buyer", to.name));
  if (to.legalAddress) buyerRows.push(infoRow("Legal address", to.legalAddress));
  if (to.registrationNumber) buyerRows.push(infoRow("Reg. No.", to.registrationNumber));
  if (to.vatNumber) buyerRows.push(infoRow("VAT reg. No.", to.vatNumber));
  if (resolvedDeliveryTo) buyerRows.push(infoRow("Delivery to", resolvedDeliveryTo.replace(/\n/g, ". ")));

  const pkgRows = packages
    .map(
      (pkg, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${pkg.packageNumber ?? ""}</td>
        <td>${pkg.productName ?? ""}</td>
        <td class="c">${pkg.woodSpecies ?? ""}</td>
        <td class="c">${pkg.humidity ?? ""}</td>
        <td class="c">${pkg.processing ?? ""}</td>
        <td class="c">${pkg.quality ?? ""}</td>
        <td class="r">${pkg.thickness ?? ""}</td>
        <td class="r">${pkg.width ?? ""}</td>
        <td class="r">${pkg.length ?? ""}</td>
        <td class="r">${pkg.pieces ?? ""}</td>
        <td class="r">${fmtVol(pkg.volumeM3)}</td>
      </tr>`
    )
    .join("");

  return `
    <!-- Header: logo/name centered with decorative lines -->
    <div class="logo-header">
      <div class="logo-line"></div>
      <div class="logo-center">${orgHeaderHtml(from)}</div>
      <div class="logo-line"></div>
    </div>

    <!-- Title -->
    <div class="doc-title">Packing list No. ${shipmentCode}</div>
    <div class="doc-date">${fmtDate(shipmentDate)}</div>

    <!-- Supplier block -->
    <table class="info-table">
      ${supplierRows.join("")}
    </table>

    <!-- Separator -->
    <div class="separator"></div>

    <!-- Buyer block -->
    <table class="info-table">
      ${buyerRows.join("")}
    </table>

    <!-- Type of transaction -->
    <div class="transaction-info">
      Type of transaction <strong>Transportation of goods</strong>
    </div>
    <div class="transaction-info" style="margin-bottom:14px;">
      Other information <strong>Packing list No. ${shipmentCode}</strong>
    </div>

    <!-- Package table -->
    <table class="pkg">
      <thead>
        <tr>
          <th rowspan="2" class="c" style="width:28px;">No.</th>
          <th rowspan="2">Package<br/>number</th>
          <th rowspan="2">Product name</th>
          <th rowspan="2" class="c">Wood<br/>species</th>
          <th rowspan="2" class="c">Humidity</th>
          <th rowspan="2" class="c">Processing</th>
          <th rowspan="2" class="c">Quality</th>
          <th colspan="3" class="c">Dimensions</th>
          <th rowspan="2" class="r">Pieces/<br/>package</th>
          <th rowspan="2" class="r">Volume m3</th>
        </tr>
        <tr>
          <th class="r">Thickness</th>
          <th class="r">Width</th>
          <th class="r">Length</th>
        </tr>
      </thead>
      <tbody>
        ${pkgRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="11" class="r total-cell">Total</td>
          <td class="r total-cell">${fmtVol(totalVolume)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-label">Issued by: <span class="sig-line"></span></div>
        <div class="sig-hint">(name, last name, signature)</div>
        <div class="sig-date-line"><span class="sig-line-short">${fmtDate(shipmentDate)}</span></div>
        <div class="sig-hint">(date)</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Transported by: <span class="sig-line"></span></div>
        <div class="sig-hint">(name, last name, signature)</div>
        <div class="sig-date-line"><span class="sig-line-short"></span></div>
        <div class="sig-hint">(date)</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Received by: <span class="sig-line"></span></div>
        <div class="sig-hint">(name, last name, signature)</div>
        <div class="sig-date-line"><span class="sig-line-short"></span></div>
        <div class="sig-hint">(date)</div>
      </div>
    </div>
  `;
}

const PACKING_LIST_STYLES = `
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 9pt; color: #000; }
  img { display: block; }
  .c { text-align: center; }
  .r { text-align: right; }
  .bold { font-weight: bold; }

  /* Logo header */
  .logo-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .logo-line { flex: 1; border-bottom: 1px solid #999; }
  .logo-center { flex-shrink: 0; }

  /* Title */
  .doc-title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 6px; }
  .doc-date { font-size: 9pt; margin-bottom: 16px; }

  /* Info tables (supplier/buyer) */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .info-label { width: 110px; padding: 2px 8px 2px 0; font-size: 9pt; color: #333; vertical-align: top; }
  .info-value { padding: 2px 0; font-size: 9pt; }
  .info-value.bold { font-weight: bold; }

  /* Separator */
  .separator { border-bottom: 1px solid #ccc; margin-bottom: 10px; }

  /* Transaction info */
  .transaction-info { font-size: 9pt; margin-bottom: 3px; }

  /* Package table */
  table.pkg { border-collapse: collapse; width: 100%; font-size: 8pt; }
  table.pkg th, table.pkg td { padding: 3px 4px; border: 1px solid #999; }
  table.pkg thead th { background: #f5f5f5; font-size: 7.5pt; font-weight: 600; }
  table.pkg tbody td { font-size: 8pt; }
  .total-cell { font-weight: bold; border-top: 2px solid #000; }

  /* Signatures */
  .signatures { display: flex; gap: 16px; margin-top: 40px; }
  .sig-block { flex: 1; }
  .sig-label { font-size: 9pt; }
  .sig-line { display: inline-block; width: 160px; border-bottom: 1px solid #000; }
  .sig-hint { font-size: 7pt; color: #666; margin-top: 2px; padding-left: 60px; }
  .sig-date-line { margin-top: 12px; font-size: 9pt; }
  .sig-line-short { display: inline-block; width: 120px; border-bottom: 1px solid #000; }
`;

export function PrintPackingListButton({
  shipmentId,
  shipmentCode,
  shipmentDate,
  packages,
}: PrintPackingListButtonProps) {
  const [open, setOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    from: OrgPrintInfo;
    to: OrgPrintInfo;
    deliveryFromText: string | null;
    deliveryToText: string | null;
  } | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    getShipmentPrintData(shipmentId).then((result) => {
      if (result.success) setPrintData(result.data);
      setLoadingData(false);
    });
  }, [open, shipmentId]);

  if (packages.length === 0) return null;

  const html = printData
    ? buildPackingListHtml(
        shipmentCode, shipmentDate, packages,
        printData.from, printData.to,
        printData.deliveryFromText, printData.deliveryToText
      )
    : "";

  const handlePrint = () => {
    if (!html) return;
    printHtml(html, PACKING_LIST_STYLES);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1" />
        Packing List
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Packing List — {shipmentCode}</DialogTitle>
          </DialogHeader>

          {loadingData || !printData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <DocumentPreviewIframe html={html} styles={PACKING_LIST_STYLES} height="calc(95vh - 140px)" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button onClick={handlePrint}>
                  <FileText className="h-4 w-4 mr-1" />
                  Print / Save as PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
