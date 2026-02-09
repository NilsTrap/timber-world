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
import type { Product } from "@timber/database";
import { SortableHeader } from "./SortableHeader";

interface ProductTableProps {
  products: Product[];
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
      "rounded-lg border bg-background flex flex-col h-full overflow-hidden",
      isPending && "opacity-50"
    )}>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent [&_th]:text-black [&_th]:whitespace-nowrap [&_th]:p-2 h-14">
              <TableHead className="w-12 bg-background">
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
              <TableHead className="bg-background">
                <SortableHeader
                  column="thickness"
                  label={t("thickness")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 9. Width */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="width"
                  label={t("width")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 10. Length */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="length"
                  label={t("length")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 11. Pieces */}
              <TableHead className="bg-background">
                <SortableHeader
                  column="stock_quantity"
                  label={t("pieces")}
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={onSortChange}
                />
              </TableHead>
              {/* 12. m³ */}
              <TableHead className="bg-background">{t("cubicMeters")}</TableHead>
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
              <TableHead className="text-right bg-background">
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
                className="cursor-pointer text-black [&_td]:whitespace-nowrap"
                onClick={() => onToggleSelect(product.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
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
                <TableCell>{product.thickness} {t("mm")}</TableCell>
                {/* 9. Width */}
                <TableCell>{product.width} {t("mm")}</TableCell>
                {/* 10. Length */}
                <TableCell>{product.length} {t("mm")}</TableCell>
                {/* 11. Pieces */}
                <TableCell>{product.stock_quantity}</TableCell>
                {/* 12. m³ */}
                <TableCell>
                  {((product.thickness / 1000) * (product.width / 1000) * (product.length / 1000)).toFixed(4)}
                </TableCell>
                {/* 13. EUR/piece */}
                <TableCell className="text-right">
                  {(product.unit_price_piece / 100).toFixed(2)}
                </TableCell>
                {/* 14. EXW/m³ */}
                <TableCell className="text-right">
                  {(product.unit_price_m3 / 100).toFixed(0)}
                </TableCell>
                {/* 15. EXW/m² */}
                <TableCell className="text-right">
                  {(product.unit_price_m2 / 100).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
