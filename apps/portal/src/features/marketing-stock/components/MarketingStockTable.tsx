"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { getMarketingStock, type MarketingStockItem } from "../actions/getMarketingStock";

function formatPrice(cents: number | null): string {
  if (cents === null || cents === 0) return "On Request";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function MarketingStockTable() {
  const [data, setData] = useState<MarketingStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarketingStock().then((result) => {
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, []);

  const totalPieces = useMemo(() => data.reduce((sum, d) => sum + d.pieces, 0), [data]);
  const totalVolume = useMemo(
    () => data.reduce((sum, d) => sum + (d.volume_m3 || 0), 0),
    [data]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium">{data.length}</span> packages |{" "}
        <span className="font-medium">{totalPieces.toLocaleString()}</span> pcs |{" "}
        <span className="font-medium">{totalVolume.toFixed(3).replace(".", ",")}</span> m³
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No marketing stock data. Enable organisations in the Sources tab.
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-auto max-h-[75vh]">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:border-b">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Species</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Humidity</TableHead>
                <TableHead className="text-right">Thick</TableHead>
                <TableHead className="text-right">Width</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead className="text-right">Pcs</TableHead>
                <TableHead className="text-right">m³</TableHead>
                <TableHead className="text-right">€/pc</TableHead>
                <TableHead className="text-right">€/m³</TableHead>
                <TableHead className="text-right">€/m²</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.organisation_code}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.species}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.quality}</TableCell>
                  <TableCell>{item.humidity}</TableCell>
                  <TableCell className="text-right">{item.thickness}</TableCell>
                  <TableCell className="text-right">{item.width}</TableCell>
                  <TableCell className="text-right">{item.length}</TableCell>
                  <TableCell className="text-right">{item.pieces}</TableCell>
                  <TableCell className="text-right">
                    {item.volume_m3 ? item.volume_m3.toFixed(3).replace(".", ",") : "-"}
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_piece)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_m3)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_m2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
