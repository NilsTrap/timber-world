"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";

interface PrintablePackage {
  id: string;
  shipmentCode: string;
  packageNumber: string;
  productName?: string | null;
  woodSpecies?: string | null;
  humidity?: string | null;
  typeName?: string | null;
  processing?: string | null;
  fsc?: string | null;
  quality?: string | null;
  thickness?: string | null;
  width?: string | null;
  length?: string | null;
  pieces?: string | null;
  volumeM3?: number | null;
  organisationCode?: string | null;
}

interface PrintInventoryButtonProps {
  packages: PrintablePackage[];
  title?: string;
  showOrganisation?: boolean;
}

/**
 * Print Inventory Button
 *
 * Opens a print-friendly dialog with inventory packages list.
 * Users can print or save as PDF using the browser's print dialog.
 * Respects current filters - only prints packages passed to it.
 */
export function PrintInventoryButton({
  packages,
  title = "Inventory Packages",
  showOrganisation = false,
}: PrintInventoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const totalVolume = packages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
  const totalPieces = packages.reduce((sum, p) => {
    const n = p.pieces ? parseInt(p.pieces, 10) : 0;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  if (packages.length === 0) {
    return null;
  }

  const tableContent = (
    <>
      {/* Header for print */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-gray-600">
          Total packages: {packages.length} | Total pieces: {totalPieces} | Total volume: {totalVolume.toFixed(3).replace(".", ",")} m³
        </p>
      </div>

      {/* Table */}
      <table className="text-sm border-collapse whitespace-nowrap w-full">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 px-2 font-semibold">#</th>
            {showOrganisation && (
              <th className="text-left py-2 px-2 font-semibold">Org</th>
            )}
            <th className="text-left py-2 px-2 font-semibold">Shipment</th>
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
              {showOrganisation && (
                <td className="py-2 px-2">{pkg.organisationCode || "-"}</td>
              )}
              <td className="py-2 px-2">{pkg.shipmentCode}</td>
              <td className="py-2 px-2 font-medium">{pkg.packageNumber}</td>
              <td className="py-2 px-2">{pkg.productName || "-"}</td>
              <td className="py-2 px-2">{pkg.woodSpecies || "-"}</td>
              <td className="py-2 px-2">{pkg.humidity || "-"}</td>
              <td className="py-2 px-2">{pkg.typeName || "-"}</td>
              <td className="py-2 px-2">
                {pkg.thickness && pkg.width && pkg.length
                  ? `${pkg.thickness}x${pkg.width}x${pkg.length}`
                  : "-"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {pkg.pieces || "-"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {pkg.volumeM3 != null ? pkg.volumeM3.toFixed(3).replace(".", ",") : "-"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={showOrganisation ? 9 : 8} className="py-2 px-2">Total</td>
            <td className="py-2 px-2 text-right tabular-nums">{totalPieces}</td>
            <td className="py-2 px-2 text-right tabular-nums">
              {totalVolume.toFixed(3).replace(".", ",")}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Print timestamp */}
      <p className="mt-4 text-xs text-gray-500">
        Printed: {new Date().toLocaleString("en-GB")}
      </p>
    </>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      {/* Print-only content - portaled to body, hidden on screen, shown when printing */}
      {mounted && open && createPortal(
        <div
          id="print-area"
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "white",
            padding: "20px",
            zIndex: 99999,
          }}
        >
          {tableContent}
        </div>,
        document.body
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[98vw] max-h-[90vh] overflow-auto w-fit min-w-[900px]">
          <DialogHeader>
            <DialogTitle>Print {title}</DialogTitle>
          </DialogHeader>

          {/* Screen preview content */}
          <div className="overflow-x-auto">
            {tableContent}
          </div>

          {/* Print button */}
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

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body > *:not(#print-area) {
            display: none !important;
          }
          #print-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            padding: 0 !important;
          }
          #print-area table {
            width: 100% !important;
            font-size: 10pt !important;
          }
          #print-area th,
          #print-area td {
            padding: 4px 6px !important;
          }
        }
      `}</style>
    </>
  );
}
