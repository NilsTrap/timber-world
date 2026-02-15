"use client";

import type { ConsolidatedInventoryItem } from "../types";

interface ConsolidatedInventoryTableProps {
  data: ConsolidatedInventoryItem[];
}

/**
 * Consolidated Inventory Table
 *
 * Displays inventory grouped by 6 attributes with totals.
 */
export function ConsolidatedInventoryTable({ data }: ConsolidatedInventoryTableProps) {
  // Calculate grand totals
  const grandTotals = data.reduce(
    (acc, row) => ({
      packageCount: acc.packageCount + row.packageCount,
      totalPieces: acc.totalPieces + row.totalPieces,
      totalVolumeM3: acc.totalVolumeM3 + row.totalVolumeM3,
    }),
    { packageCount: 0, totalPieces: 0, totalVolumeM3: 0 }
  );

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm text-center">
        <p className="text-muted-foreground">No inventory data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Product</th>
              <th className="text-left p-3 font-medium">Species</th>
              <th className="text-left p-3 font-medium">Humidity</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Processing</th>
              <th className="text-left p-3 font-medium">Quality</th>
              <th className="text-right p-3 font-medium">Packages</th>
              <th className="text-right p-3 font-medium">Pieces</th>
              <th className="text-right p-3 font-medium">Volume m³</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className="p-3">{row.productName || "—"}</td>
                <td className="p-3">{row.woodSpecies || "—"}</td>
                <td className="p-3">{row.humidity || "—"}</td>
                <td className="p-3">{row.typeName || "—"}</td>
                <td className="p-3">{row.processing || "—"}</td>
                <td className="p-3">{row.quality || "—"}</td>
                <td className="p-3 text-right tabular-nums">{row.packageCount}</td>
                <td className="p-3 text-right tabular-nums">{row.totalPieces.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums font-medium">
                  {row.totalVolumeM3.toFixed(3).replace(".", ",")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 font-semibold">
              <td colSpan={6} className="p-3">Total</td>
              <td className="p-3 text-right tabular-nums">{grandTotals.packageCount}</td>
              <td className="p-3 text-right tabular-nums">{grandTotals.totalPieces.toLocaleString()}</td>
              <td className="p-3 text-right tabular-nums">
                {grandTotals.totalVolumeM3.toFixed(3).replace(".", ",")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
