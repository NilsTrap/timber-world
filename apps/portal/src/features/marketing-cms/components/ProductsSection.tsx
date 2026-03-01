"use client";

import { MediaCard } from "./MediaCard";
import type { MarketingMedia } from "../types";

interface ProductsSectionProps {
  media: MarketingMedia[];
  onReplace: (media: MarketingMedia) => void;
}

/**
 * ProductsSection
 *
 * Displays product images for the Products page.
 */
export function ProductsSection({ media, onReplace }: ProductsSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Products</h3>
      <p className="text-sm text-muted-foreground">
        Images shown on the Products page. Each product can have a title and description managed in the Texts tab.
      </p>
      {media.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products configured.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((m) => (
            <MediaCard key={m.id} media={m} onReplace={onReplace} />
          ))}
        </div>
      )}
    </div>
  );
}
