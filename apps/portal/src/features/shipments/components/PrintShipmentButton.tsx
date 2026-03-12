"use client";

import { useState, useMemo, useRef } from "react";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml, PRINT_STYLES_TABLE } from "@/lib/print";
import type { PackageDetail } from "../types";

interface PrintShipmentButtonProps {
  shipmentCode: string;
  fromOrgName: string;
  toOrgName: string;
  shipmentDate: string;
  packages: PackageDetail[];
}

function formatVolume(vol: number | null): string {
  if (vol === null || vol === 0) return "-";
  return vol.toLocaleString("de-DE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function PrintShipmentButton({
  shipmentCode,
  fromOrgName,
  toOrgName,
  shipmentDate,
  packages,
}: PrintShipmentButtonProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!contentRef.current) return;
    printHtml(contentRef.current.innerHTML, PRINT_STYLES_TABLE);
  };

  const totalVolume = useMemo(
    () => packages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0),
    [packages]
  );

  const totalPieces = useMemo(
    () =>
      packages.reduce((sum, p) => {
        const n = p.pieces != null ? Number(p.pieces) : 0;
        return sum + (isNaN(n) ? 0 : n);
      }, 0),
    [packages]
  );

  if (packages.length === 0) {
    return null;
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[98vw] max-h-[90vh] overflow-auto w-fit min-w-[900px]">
          <DialogHeader>
            <DialogTitle>Print Shipment {shipmentCode}</DialogTitle>
          </DialogHeader>

          <div ref={contentRef} className="overflow-x-auto">
            <div className="header mb-6">
              <h1 className="text-xl font-bold">Shipment {shipmentCode}</h1>
              <p className="text-sm text-gray-600">From: {fromOrgName}</p>
              <p className="text-sm text-gray-600">To: {toOrgName}</p>
              <p className="text-sm text-gray-600">Date: {shipmentDate}</p>
              <p className="text-sm text-gray-600">
                Total packages: {packages.length} | Total pieces: {totalPieces} | Total volume: {formatVolume(totalVolume)} m³
              </p>
            </div>

            <table className="text-sm border-collapse whitespace-nowrap w-full">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2 font-semibold">#</th>
                  <th className="text-left py-2 px-2 font-semibold">Package</th>
                  <th className="text-left py-2 px-2 font-semibold">Product</th>
                  <th className="text-left py-2 px-2 font-semibold">Species</th>
                  <th className="text-left py-2 px-2 font-semibold">Humidity</th>
                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                  <th className="text-left py-2 px-2 font-semibold">Dims (TxWxL)</th>
                  <th className="text-right py-2 px-2 font-semibold">Pieces</th>
                  <th className="text-right py-2 px-2 font-semibold">Vol m³</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, index) => (
                  <tr key={pkg.id} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2 font-medium">{pkg.packageNumber ?? "-"}</td>
                    <td className="py-2 px-2">{pkg.productName ?? "-"}</td>
                    <td className="py-2 px-2">{pkg.woodSpecies ?? "-"}</td>
                    <td className="py-2 px-2">{pkg.humidity ?? "-"}</td>
                    <td className="py-2 px-2">{pkg.typeName ?? "-"}</td>
                    <td className="py-2 px-2">
                      {pkg.thickness && pkg.width && pkg.length
                        ? `${pkg.thickness}x${pkg.width}x${pkg.length}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{pkg.pieces ?? "-"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {pkg.volumeM3 ? formatVolume(pkg.volumeM3) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={7} className="py-2 px-2">Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{totalPieces}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatVolume(totalVolume)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-4 text-xs text-gray-500">
              Printed: {new Date().toLocaleString("en-GB")}
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
