"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import type { ProductionInput } from "../types";

interface PrintInputsButtonProps {
  inputs: ProductionInput[];
  processName?: string;
  productionDate?: string;
}

/**
 * Print Inputs Button
 *
 * Opens a print-friendly dialog with input packages list.
 * Users can print or save as PDF using the browser's print dialog.
 */
export function PrintInputsButton({ inputs, processName, productionDate }: PrintInputsButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const totalVolume = inputs.reduce((sum, i) => sum + i.volumeM3, 0);

  if (inputs.length === 0) {
    return null;
  }

  const tableContent = (
    <>
      {/* Header for print */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">Production Input Packages</h1>
        {processName && (
          <p className="text-sm text-gray-600">
            Process: {processName}
          </p>
        )}
        {productionDate && (
          <p className="text-sm text-gray-600">
            Date: {productionDate}
          </p>
        )}
        <p className="text-sm text-gray-600">
          Total packages: {inputs.length} | Total volume: {totalVolume.toFixed(3).replace(".", ",")} m³
        </p>
      </div>

      {/* Table */}
      <table className="text-sm border-collapse whitespace-nowrap w-full">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 px-2 font-semibold">#</th>
            <th className="text-left py-2 px-2 font-semibold">Shipment</th>
            <th className="text-left py-2 px-2 font-semibold">Package</th>
            <th className="text-left py-2 px-2 font-semibold">Product</th>
            <th className="text-left py-2 px-2 font-semibold">Species</th>
            <th className="text-left py-2 px-2 font-semibold">Dims (TxWxL)</th>
            <th className="text-right py-2 px-2 font-semibold">Pieces</th>
            <th className="text-right py-2 px-2 font-semibold">Vol m³</th>
            <th className="text-center py-2 px-2 font-semibold" style={{ width: "32px" }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {inputs.map((input, index) => (
            <tr key={input.id} className="border-b border-gray-300">
              <td className="py-2 px-2">{index + 1}</td>
              <td className="py-2 px-2">{input.shipmentCode}</td>
              <td className="py-2 px-2 font-medium">{input.packageNumber}</td>
              <td className="py-2 px-2">{input.productName || "-"}</td>
              <td className="py-2 px-2">{input.woodSpecies || "-"}</td>
              <td className="py-2 px-2">
                {input.thickness && input.width && input.length
                  ? `${input.thickness}x${input.width}x${input.length}`
                  : "-"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {input.piecesUsed ?? input.availablePieces ?? "-"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {input.volumeM3.toFixed(3).replace(".", ",")}
              </td>
              <td className="py-2 px-2 text-center">
                <div className="w-5 h-5 border-2 border-gray-400 mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={6} className="py-2 px-2">Total</td>
            <td className="py-2 px-2 text-right tabular-nums">
              {inputs.reduce((sum, i) => sum + (i.piecesUsed ?? (parseInt(i.availablePieces || "0", 10) || 0)), 0)}
            </td>
            <td className="py-2 px-2 text-right tabular-nums">
              {totalVolume.toFixed(3).replace(".", ",")}
            </td>
            <td />
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
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Print Input Packages</DialogTitle>
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
          body > *:not(#print-area) {
            display: none !important;
          }
          #print-area {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
