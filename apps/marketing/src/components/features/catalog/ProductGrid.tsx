"use client";

import { cn } from "@timber/ui";
import type { Product } from "@timber/database";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  selectedProducts: Set<string>;
  onToggleSelect: (productId: string) => void;
  isPending: boolean;
}

export function ProductGrid({
  products,
  selectedProducts,
  onToggleSelect,
  isPending,
}: ProductGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 gap-4",
      isPending && "opacity-50"
    )}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isSelected={selectedProducts.has(product.id)}
          onToggleSelect={() => onToggleSelect(product.id)}
        />
      ))}
    </div>
  );
}
