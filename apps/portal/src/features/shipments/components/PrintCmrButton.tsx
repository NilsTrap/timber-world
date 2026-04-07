"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml } from "@/lib/print";
import { DocumentPreviewIframe } from "./DocumentPreviewIframe";
import { getShipmentPrintData, type OrgPrintInfo } from "../actions/getShipmentPrintData";
import type { PackageDetail } from "../types";

interface PrintCmrButtonProps {
  shipmentId: string;
  shipmentCode: string;
  shipmentDate: string;
  packages: PackageDetail[];
}

function fmtVol(vol: number): string {
  return vol.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function estimateWeight(species: string | null, volumeM3: number | null): number {
  if (!volumeM3) return 0;
  const s = (species ?? "").toLowerCase();
  if (s.includes("pine") || s.includes("spruce") || s.includes("mänd") || s.includes("kuusk")) return volumeM3 * 500;
  if (s.includes("oak") || s.includes("tamm") || s.includes("birch") || s.includes("kask")) return volumeM3 * 700;
  return volumeM3 * 600;
}

function buildDefaultDeliveryCmr(org: OrgPrintInfo): string | null {
  if (org.deliveryAddresses.length === 0) return null;
  const addr = org.deliveryAddresses.find((a) => a.isDefault) ?? org.deliveryAddresses[0]!;
  const parts = [addr.address];
  if (addr.contactName) parts.push(addr.contactName);
  if (addr.contactPhone) parts.push(addr.contactPhone);
  if (addr.contactHours) parts.push(addr.contactHours);
  return parts.join("\n");
}

function buildCmrHtml(
  shipmentCode: string,
  shipmentDate: string,
  packages: PackageDetail[],
  from: OrgPrintInfo,
  to: OrgPrintInfo,
  deliveryFromText: string | null,
  deliveryToText: string | null
): string {
  const totalVolume = packages.reduce((s, p) => s + (p.volumeM3 ?? 0), 0);
  const totalWeight = packages.reduce((s, p) => s + estimateWeight(p.woodSpecies, p.volumeM3), 0);

  const senderLines = [from.name];
  if (from.legalAddress) senderLines.push(from.legalAddress);
  if (from.country) senderLines.push(from.country);

  const consigneeLines = [to.name];
  if (to.legalAddress) consigneeLines.push(to.legalAddress);
  if (to.country) consigneeLines.push(to.country);

  const deliveryPlace = deliveryToText || buildDefaultDeliveryCmr(to) || to.legalAddress || to.name;
  const takingOverPlace = deliveryFromText || buildDefaultDeliveryCmr(from) || from.legalAddress || from.name;

  // Goods rows
  const goodsRows = packages
    .map(
      (pkg) => `<tr>
        <td>${pkg.packageNumber ?? ""}</td>
        <td class="c">1</td>
        <td class="c"></td>
        <td>${pkg.productName ?? "Boards"}</td>
        <td class="c"></td>
        <td class="r">${pkg.volumeM3 ? Math.round(estimateWeight(pkg.woodSpecies, pkg.volumeM3)).toLocaleString("de-DE") : ""}</td>
        <td class="r">${pkg.volumeM3 ? fmtVol(pkg.volumeM3) : ""}</td>
      </tr>`
    )
    .join("");

  // Empty filler rows so the goods area has consistent height
  const fillerCount = Math.max(0, 10 - packages.length);
  const fillerRows = Array(fillerCount).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join("");

  return `
<table class="cmr">
  <!-- Row 1: Sender + CMR title -->
  <tr>
    <td class="box" colspan="4" style="width:50%;">
      <div class="lbl">1 Sender (name, address, country)</div>
      <div class="val">${senderLines.join("<br/>")}</div>
    </td>
    <td class="box" colspan="3">
      <div style="text-align:right;font-size:8pt;">INTERNATIONAL CONSIGNMENT NOTE</div>
      <div style="text-align:right;font-size:7pt;margin-top:2px;">No. Packing list No. <strong>${shipmentCode}</strong></div>
      <div style="text-align:center;margin:8px 0;">
        <span class="cmr-badge">CMR</span>
      </div>
      <div style="font-size:6.5pt;color:#444;text-align:right;line-height:1.4;">
        This carriage is subject, notwithstanding any<br/>
        clause to the contrary, to the Convention on the<br/>
        contract for the international Carriage of goods by<br/>
        road (CMR)
      </div>
    </td>
  </tr>

  <!-- Row 2: Consignee + Carrier -->
  <tr>
    <td class="box" colspan="4">
      <div class="lbl">2 Consignee (name, address, country)</div>
      <div class="val">${consigneeLines.join("<br/>")}</div>
    </td>
    <td class="box" colspan="3">
      <div class="lbl">16 Carrier (name, address, country)</div>
      <div class="val empty">&nbsp;</div>
    </td>
  </tr>

  <!-- Row 3: Delivery + Successive carriers -->
  <tr>
    <td class="box" colspan="4">
      <div class="lbl">3 Place of delivery of the goods</div>
      <div class="val">${deliveryPlace.replace(/\n/g, "<br/>")}</div>
    </td>
    <td class="box" colspan="3">
      <div class="lbl">17 Successive carriers (name, address, country)</div>
      <div class="val empty">&nbsp;</div>
    </td>
  </tr>

  <!-- Row 4: Taking over + Reservations -->
  <tr>
    <td class="box" colspan="4">
      <div class="lbl">4 Place and date of taking over the goods (place, country, date)</div>
      <div class="val">${takingOverPlace.replace(/\n/g, "<br/>")}</div>
    </td>
    <td class="box" colspan="3">
      <div class="lbl">18 Carrier's reservation and observations</div>
      <div class="val empty">&nbsp;</div>
    </td>
  </tr>

  <!-- Row 5: Documents attached -->
  <tr>
    <td class="box" colspan="7">
      <div class="lbl">5 Documents attached</div>
      <div class="val empty">&nbsp;</div>
    </td>
  </tr>

  <!-- Goods header (boxes 6-12) -->
  <tr>
    <td class="box goods-hdr">6 Marks and Nos</td>
    <td class="box goods-hdr c" style="width:55px;">7 Number of<br/>packages</td>
    <td class="box goods-hdr c" style="width:55px;">8 Method of<br/>packing</td>
    <td class="box goods-hdr">9 Nature of the goods</td>
    <td class="box goods-hdr c" style="width:55px;">10 Statistical<br/>number</td>
    <td class="box goods-hdr r" style="width:75px;">11 Gross weight<br/>in kg</td>
    <td class="box goods-hdr r" style="width:65px;">12 Volume in<br/>m3</td>
  </tr>

  <!-- Goods data -->
  <tr>
    <td colspan="7" class="goods-body">
      <table class="goods-table">
        ${goodsRows}
        <!-- Totals -->
        <tr class="goods-total">
          <td></td><td></td><td></td><td></td><td></td>
          <td class="r">${totalWeight > 0 ? Math.round(totalWeight).toLocaleString("de-DE") : ""}</td>
          <td class="r">${fmtVol(totalVolume)}</td>
        </tr>
        ${fillerRows}
      </table>
    </td>
  </tr>

  <!-- Box 13 + Box 19 -->
  <tr>
    <td class="box" colspan="4" rowspan="2" style="vertical-align:top;">
      <div class="lbl">13 Sender's instructions (Customs and other formalities)</div>
      <div class="val empty" style="min-height:60px;">&nbsp;</div>
    </td>
    <td class="box" colspan="3" style="vertical-align:top;">
      <table class="payment-table">
        <tr><td class="lbl" colspan="4">19 To be paid by &nbsp; Sender &nbsp;&nbsp; Currency &nbsp;&nbsp; Consignee</td></tr>
        <tr><td>Carr. charges</td></tr>
        <tr><td>Deduction (-)</td></tr>
        <tr><td>Balance</td></tr>
        <tr><td>Supp. charges</td></tr>
        <tr><td>Other ch.</td></tr>
        <tr><td>Miscellaneous (+)</td></tr>
        <tr><td style="border-top:1px solid #000;font-weight:bold;">Total</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td class="box" colspan="3" style="vertical-align:top;">
      <div class="lbl">20 Special agreements</div>
      <div class="val empty">&nbsp;</div>
    </td>
  </tr>

  <!-- Box 14 + 15 -->
  <tr>
    <td class="box" colspan="4">
      <div class="lbl">14 Instructions as to payment for carriage</div>
    </td>
    <td colspan="3" style="border:none;"></td>
  </tr>
  <tr>
    <td class="box" colspan="4">
      <div class="lbl">15 Cash on delivery</div>
      <div style="font-size:7pt;padding-left:12px;">Franco<br/>Non franco</div>
    </td>
    <td colspan="3" style="border:none;"></td>
  </tr>

  <!-- Box 21 + Date + Box 24 -->
  <tr>
    <td class="box" colspan="2">
      <div class="lbl">21 Established in</div>
    </td>
    <td class="box" colspan="2">
      <div style="font-size:8pt;">Date <strong>${fmtDate(shipmentDate)}</strong></div>
    </td>
    <td class="box" colspan="3">
      <div class="lbl">24 Goods received</div>
    </td>
  </tr>

  <!-- Box 22 + 23 + arrival/departure -->
  <tr>
    <td class="box" colspan="2" style="height:36px;">
      <div class="lbl">22</div>
      <div class="small-field">Arrival for loading _____ H. _____ Min.</div>
      <div class="small-field">Departure _____ H. _____ Min.</div>
    </td>
    <td class="box" colspan="2">
      <div class="lbl">23</div>
      <div class="small-field">Waybill Nr. ______________ Date ______________</div>
      <div class="small-field">Drivers ______________</div>
    </td>
    <td class="box" colspan="3">
      <div class="small-field">Arrival for unloading _____ H _____ Min.</div>
    </td>
  </tr>

  <!-- Signature stamps -->
  <tr>
    <td class="box sig-stamp" colspan="2">
      <div class="small-field">Signature and stamp of the sender</div>
    </td>
    <td class="box sig-stamp" colspan="2">
      <div class="small-field">Signature and stamp of the carrier</div>
    </td>
    <td class="box" colspan="3" style="vertical-align:top;">
      <div class="small-field">Departure _____ H _____ Min.</div>
      <div style="height:24px;"></div>
      <div class="small-field">Signature and stamp of the consignee</div>
    </td>
  </tr>

  <!-- Box 25 + 26 -->
  <tr>
    <td class="box" colspan="2">
      <div class="lbl">25 Registration Nr. &nbsp;&nbsp;&nbsp; Semitrailer</div>
      <div class="small-field">Truck</div>
    </td>
    <td class="box" colspan="2">
      <div class="lbl">26 Type &nbsp;&nbsp;&nbsp; Semitrailer</div>
      <div class="small-field">Truck</div>
    </td>
    <td colspan="3" style="border:none;"></td>
  </tr>
</table>
  `;
}

const CMR_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 8pt; color: #000; }
  .c { text-align: center; }
  .r { text-align: right; }

  table.cmr { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .box { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  .lbl { font-size: 7pt; color: #555; margin-bottom: 2px; }
  .val { font-size: 9pt; padding: 2px 0; font-weight: bold; }
  .val.empty { font-weight: normal; }

  .cmr-badge {
    display: inline-block;
    font-size: 20pt;
    font-weight: bold;
    border: 2px solid #000;
    padding: 1px 14px;
    letter-spacing: 2px;
  }

  /* Goods table */
  .goods-hdr { font-size: 7pt; color: #555; }
  .goods-body { border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 0; }
  .goods-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .goods-table td { padding: 1px 4px; }
  .goods-total td { border-top: 1px solid #999; font-weight: bold; }

  /* Payment table */
  .payment-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
  .payment-table td { padding: 1px 4px; }

  /* Signature area */
  .sig-stamp { height: 50px; vertical-align: top; }

  /* Small field text */
  .small-field { font-size: 7pt; padding: 2px 0; }
`;

export function PrintCmrButton({
  shipmentId,
  shipmentCode,
  shipmentDate,
  packages,
}: PrintCmrButtonProps) {
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
    ? buildCmrHtml(
        shipmentCode, shipmentDate, packages,
        printData.from, printData.to,
        printData.deliveryFromText, printData.deliveryToText
      )
    : "";

  const handlePrint = () => {
    if (!html) return;
    printHtml(html, CMR_STYLES);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1" />
        CMR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>CMR — {shipmentCode}</DialogTitle>
          </DialogHeader>

          {loadingData || !printData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <DocumentPreviewIframe html={html} styles={CMR_STYLES} height="calc(95vh - 140px)" />
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
