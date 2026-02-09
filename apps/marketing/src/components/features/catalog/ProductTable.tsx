"use client";

import { useTranslations } from "next-intl";
import {
  cn,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
} from "@timber/ui";
import type { StockProduct } from "@/lib/actions/products";
import { SortableHeader } from "./SortableHeader";

interface ProductTableProps {
  products: StockProduct[];
  selectedProducts: Set<string>;
  sortBy?: string;
  sortOrder: "asc" | "desc";
  onToggleSelect: (productId: string) => void;
  onSelectAll: () => void;
  onSortChange: (column: string, order: "asc" | "desc") => void;
  isPending: boolean;
}

export function ProductTable({
  products,
  selectedProducts,
  sortBy,
  sortOrder,
  onToggleSelect,
  onSelectAll,
  onSortChange,
  isPending,
}: ProductTableProps) {
  const t = useTranslations("catalog");
  const allSelected = products.length > 0 && products.every(p => selectedProducts.has(p.id));
  const someSelected = products.some(p => selectedProducts.has(p.id)) && !allSelected;

  const handleSelectAllChange = () => {
    if (allSelected) {
      // Clear all
      products.forEach(p => onToggleSelect(p.id));
    } else {
      onSelectAll();
    }
  };

  return (
    <div className={cn(
      "rounded-lg border bg-background flex flex-col h-full overflow-hidden [&_[data-slot=table-container]]:flex-1 [&_[data-slot=table-container]]:overflow-y-auto [&_[data-slot=table-container]]:pr-4",
      isPending && "opacity-50"
    )}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background border-b">
            <TableRow className="hover:bg-transparent [&_th]:text-black [&_th]:whitespace-nowrap [&_th]:px-0.5 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold h-12">
              <TableHead className="w-6 bg-background pl-2">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={handleSelectAllChange}
                  aria-label={t("selectAll")}
                />
              </TableHead>
              {/* 1. Product (name) */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="name"
                  label={t("product")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 2. Species */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="species"
                  label={t("species")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 3. Humidity */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="moisture_content"
                  label={t("humidity")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 4. Type */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="type"
                  label={t("type")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 7. Quality */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="quality_grade"
                  label={t("quality")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 8. Thickness */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="thickness"
                  label={t("thickness")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 9. Width */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="width"
                  label={t("width")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 10. Length */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="length"
                  label={t("length")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 11. Pieces */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="stock_quantity"
                  label={t("pieces")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 12. m³ */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="volume_m3"
                  label={t("cubicMeters")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 13. EUR/piece */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="unit_price_piece"
                  label={t("priceEur")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 14. EXW/m³ */}
              <TableHead className="text-right bg-background">
                <SortableHeader
                  column="unit_price_m3"
                  label={t("exwM3")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
              {/* 15. EXW/m² */}
              <TableHead className="text-right bg-background pr-4">
                <SortableHeader
                  column="unit_price_m2"
                  label={t("exwM2")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                  align="right"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                data-state={selectedProducts.has(product.id) ? "selected" : undefined}
                className="cursor-pointer text-black [&_td]:whitespace-nowrap [&_td]:px-0.5 [&_td]:py-2"
                onClick={() => onToggleSelect(product.id)}
              >
                <TableCell className="pl-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => onToggleSelect(product.id)}
                    aria-label={`Select ${product.sku}`}
                  />
                </TableCell>
                {/* 1. Product (name) */}
                <TableCell className="font-medium">{product.name}</TableCell>
                {/* 2. Species */}
                <TableCell>{product.species}</TableCell>
                {/* 3. Humidity */}
                <TableCell>{product.humidity}</TableCell>
                {/* 4. Type */}
                <TableCell>
                  {product.type === "FJ" ? t("typeFJ") : t("typeFS")}
                </TableCell>
                {/* 7. Quality */}
                <TableCell>{product.quality_grade}</TableCell>
                {/* 8. Thickness */}
                <TableCell className="text-right">{product.thickness_display || product.thickness}</TableCell>
                {/* 9. Width */}
                <TableCell className="text-right">{product.width_display || product.width}</TableCell>
                {/* 10. Length */}
                <TableCell className="text-right">{product.length_display || product.length}</TableCell>
                {/* 11. Pieces */}
                <TableCell className="text-right">{product.stock_quantity || "-"}</TableCell>
                {/* 12. m³ */}
                <TableCell className="text-right">
                  {product.volume_m3 != null && !isNaN(product.volume_m3)
                    ? product.volume_m3.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                    : "-"}
                </TableCell>
                {/* 13. EUR/piece */}
                <TableCell className="text-right">
                  {product.unit_price_piece ? (product.unit_price_piece / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t("onRequest")}
                </TableCell>
                {/* 14. EXW/m³ */}
                <TableCell className="text-right">
                  {product.unit_price_m3 ? (product.unit_price_m3 / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }) : t("onRequest")}
                </TableCell>
                {/* 15. EXW/m² */}
                <TableCell className="text-right pr-4">
                  {product.unit_price_m2 ? (product.unit_price_m2 / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t("onRequest")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
      </Table>
    </div>
  );
}
