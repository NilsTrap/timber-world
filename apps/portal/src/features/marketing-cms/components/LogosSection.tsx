"use client";

import { MediaCard } from "./MediaCard";
import type { MarketingMedia } from "../types";

interface LogosSectionProps {
  media: MarketingMedia[];
  onReplace: (media: MarketingMedia) => void;
}

/**
 * LogosSection
 *
 * Displays logo images.
 */
export function LogosSection({ media, onReplace }: LogosSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Logos</h3>
      {media.length === 0 ? (
        <p className="text-muted-foreground text-sm">No logos configured.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((m) => (
            <MediaCard key={m.id} media={m} onReplace={onReplace} />
          ))}
        </div>
      )}
    </div>
  );
}
