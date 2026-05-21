"use client";

import { useState, useRef } from "react";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml, PRINT_STYLES_TABLE } from "@/lib/print";
import type { ProductionPlanDetail } from "../types-plans";

interface PrintPlanButtonProps {
  plan: ProductionPlanDetail;
}

export function PrintPlanButton({ plan }: PrintPlanButtonProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!contentRef.current) return;
    printHtml(contentRef.current.innerHTML, PRINT_STYLES_TABLE);
  };

  const totalPieces = plan.packages.reduce((s, p) => {
    const n = parseInt(p.pieces ?? "0", 10);
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const totalVolume = plan.packages.reduce((s, p) => s + (p.volumeM3 ?? 0), 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[98vw] max-h-[90vh] overflow-auto w-fit min-w-[1100px]">
          <DialogHeader>
            <DialogTitle>Print plan: {plan.name}</DialogTitle>
          </DialogHeader>

          <div ref={contentRef} className="overflow-x-auto">
            <div className="header mb-6">
              <h1 className="text-xl font-bold">{plan.name}</h1>
              {plan.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{plan.description}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Total packages: {plan.packages.length} | Total pieces: {totalPieces} | Total volume: {totalVolume.toFixed(3).replace(".", ",")} m³
              </p>
            </div>

            <table className="text-sm border-collapse whitespace-nowrap w-full">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2 font-semibold">#</th>
                  <th className="text-left py-2 px-2 font-semibold">Shipment</th>
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
                {plan.packages.map((pkg, i) => (
                  <tr key={pkg.id} className="border-b border-gray-300">
                    <td className="py-2 px-2">{i + 1}</td>
                    <td className="py-2 px-2">{pkg.shipmentCode || "-"}</td>
                    <td className="py-2 px-2 font-medium">{pkg.packageNumber || "-"}</td>
                    <td className="py-2 px-2">{pkg.productName || "-"}</td>
                    <td className="py-2 px-2">{pkg.woodSpecies || "-"}</td>
                    <td className="py-2 px-2">{pkg.humidity || "-"}</td>
                    <td className="py-2 px-2">{pkg.typeName || "-"}</td>
                    <td className="py-2 px-2">{pkg.processing || "-"}</td>
                    <td className="py-2 px-2">{pkg.quality || "-"}</td>
                    <td className="py-2 px-2">
                      {pkg.thickness && pkg.width && pkg.length
                        ? `${pkg.thickness}x${pkg.width}x${pkg.length}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{pkg.pieces || "-"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {pkg.volumeM3 != null ? pkg.volumeM3.toFixed(3).replace(".", ",") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={10} className="py-2 px-2">Total</td>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
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
