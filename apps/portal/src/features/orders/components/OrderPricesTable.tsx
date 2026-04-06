"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { getStaircaseCodes } from "../actions";
import type { StaircaseCode } from "../actions/getStaircaseCodes";

function formatPrice(cents: number | null): string {
  if (cents === null) return "-";
  return (cents / 100).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Read-only prices reference table showing UK staircase pricing data.
 */
export function OrderPricesTable() {
  const [codes, setCodes] = useState<StaircaseCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStaircaseCodes().then((result) => {
      if (result.success) {
        setCodes(result.data);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (codes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">No pricing data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border w-fit">
      <Table className="w-auto">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead className="text-right">Thickness</TableHead>
            <TableHead className="text-right">Width</TableHead>
            <TableHead className="text-right">Length</TableHead>
            <TableHead className="text-right">Price £</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => (
            <TableRow key={code.id}>
              <TableCell className="font-medium">{code.code}</TableCell>
              <TableCell>{code.name}</TableCell>
              <TableCell>{code.productType}</TableCell>
              <TableCell>Prime</TableCell>
              <TableCell className="text-right">{code.thicknessMm}</TableCell>
              <TableCell className="text-right">{code.widthMm}</TableCell>
              <TableCell className="text-right">{code.lengthMm}</TableCell>
              <TableCell className="text-right">{formatPrice(code.finalPriceCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
