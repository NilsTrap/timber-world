"use client";

import { useState, useMemo, useRef } from "react";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml, PRINT_STYLES_TABLE } from "@/lib/print";
import type { OutputRow, ReferenceDropdowns } from "../types";

interface PrintOutputsButtonProps {
  rows: OutputRow[];
  dropdowns: ReferenceDropdowns;
  processName?: string;
  productionDate?: string;
}

export function PrintOutputsButton({
  rows,
  dropdowns,
  processName,
  productionDate,
}: PrintOutputsButtonProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!contentRef.current) return;
    printHtml(contentRef.current.innerHTML, PRINT_STYLES_TABLE);
  };

  const resolveValue = (options: { id: string; value: string }[], id: string): string => {
    const found = options.find((o) => o.id === id);
    return found?.value || "-";
  };

  const resolvedRows = useMemo(() => {
    return rows.map((row) => ({
      packageNumber: row.packageNumber || "-",
      productName: resolveValue(dropdowns.productNames, row.productNameId),
      woodSpecies: resolveValue(dropdowns.woodSpecies, row.woodSpeciesId),
      humidity: resolveValue(dropdowns.humidity, row.humidityId),
      typeName: resolveValue(dropdowns.types, row.typeId),
      processing: resolveValue(dropdowns.processing, row.processingId),
      fsc: resolveValue(dropdowns.fsc, row.fscId),
      quality: resolveValue(dropdowns.quality, row.qualityId),
      thickness: row.thickness || "-",
      width: row.width || "-",
      length: row.length || "-",
      pieces: row.pieces || "-",
      volumeM3: row.volumeM3 ? parseFloat(row.volumeM3) : 0,
    }));
  }, [rows, dropdowns]);

  const totalVolume = resolvedRows.reduce((sum, r) => sum + r.volumeM3, 0);
  const totalPieces = resolvedRows.reduce((sum, r) => {
    const n = r.pieces !== "-" ? parseInt(r.pieces, 10) : 0;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-[98vw] w-fit max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Print Production Outputs</DialogTitle>
          </DialogHeader>

          <div ref={contentRef}>
            <div className="header mb-6">
              <h1 className="text-xl font-bold">Production Outputs</h1>
              {processName && (
                <p className="text-sm text-gray-600">Process: {processName}</p>
              )}
              {productionDate && (
                <p className="text-sm text-gray-600">Date: {productionDate}</p>
              )}
              <p className="text-sm text-gray-600">
                Total packages: {rows.length} | Total pieces: {totalPieces} | Total volume: {totalVolume.toFixed(3).replace(".", ",")} m³
              </p>
            </div>

            <table className="text-sm border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2 font-semibold">#</th>
                  <th className="text-left py-2 px-2 font-semibold">Package</th>
                  <th className="text-left py-2 px-2 font-semibold">Product</th>
                  <th className="text-left py-2 px-2 font-semibold">Species</th>
                  <th className="text-left py-2 px-2 font-semibold">Humidity</th>
                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                  <th className="text-left py-2 px-2 font-semibold">Processing</th>
                  <th className="text-left py-2 px-2 font-semibold">Quality</th>
                  <th className="text-left py-2 px-2 font-semibold">Dims (TxWxL)</th>
                  <th className="text-right py-2 px-2 font-semibold">Pieces</th>
                  <th className="text-right py-2 px-2 font-semibold">Vol m³</th>
                </tr>
              </thead>
              <tbody>
                {resolvedRows.map((row, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2 font-medium">{row.packageNumber}</td>
                    <td className="py-2 px-2">{row.productName}</td>
                    <td className="py-2 px-2">{row.woodSpecies}</td>
                    <td className="py-2 px-2">{row.humidity}</td>
                    <td className="py-2 px-2">{row.typeName}</td>
                    <td className="py-2 px-2">{row.processing}</td>
                    <td className="py-2 px-2">{row.quality}</td>
                    <td className="py-2 px-2">
                      {row.thickness !== "-" && row.width !== "-" && row.length !== "-"
                        ? `${row.thickness}x${row.width}x${row.length}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{row.pieces}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.volumeM3 > 0 ? row.volumeM3.toFixed(3).replace(".", ",") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={9} className="py-2 px-2">Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{totalPieces}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {totalVolume.toFixed(3).replace(".", ",")}
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
