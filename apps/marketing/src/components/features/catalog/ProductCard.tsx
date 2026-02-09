"use client";

import { useTranslations } from "next-intl";
import { cn, Card, CardContent, Checkbox } from "@timber/ui";
import type { Product } from "@timber/database";
import { StockStatusBadge } from "./StockStatusBadge";
import { PriceDisplay } from "./PriceDisplay";

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function ProductCard({ product, isSelected, onToggleSelect }: ProductCardProps) {
  const t = useTranslations("catalog");

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-forest-green"
      )}
      onClick={onToggleSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${product.sku}`}
              />
              <span className="font-semibold text-charcoal truncate">{product.sku}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{product.species}</p>
            <p className="text-sm">
              {product.thickness} × {product.width} × {product.length} {t("mm")}
            </p>
          </div>
          <StockStatusBadge status={product.stock_status} />
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t("qualityGrade")}:</span>
            <span className="ml-1 font-medium">{product.quality_grade}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("type")}:</span>
            <span className="ml-1 font-medium">
              {product.type === "FJ" ? t("typeFJ") : t("typeFS")}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">{t("priceM3")}</p>
              <p className="font-semibold">
                <PriceDisplay cents={product.unit_price_m3} />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t("pricePiece")}</p>
              <p className="font-semibold">
                <PriceDisplay cents={product.unit_price_piece} />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t("priceM2")}</p>
              <p className="font-semibold">
                <PriceDisplay cents={product.unit_price_m2} />
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
