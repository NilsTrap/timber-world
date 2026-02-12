"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@timber/ui";
import type { TopProduct } from "../types";

interface TopProductsTableProps {
  data: TopProduct[];
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Selected Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No product selection data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Selected Products</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Species</TableHead>
              <TableHead className="text-right">Selections</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((product, index) => (
              <TableRow key={product.productId}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{product.productName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.species || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {product.viewCount.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
