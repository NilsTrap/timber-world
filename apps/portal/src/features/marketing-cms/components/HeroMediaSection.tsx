"use client";

import { MediaCard } from "./MediaCard";
import type { MarketingMedia } from "../types";

interface HeroMediaSectionProps {
  media: MarketingMedia[];
  onReplace: (media: MarketingMedia) => void;
}

/**
 * HeroMediaSection
 *
 * Displays hero video and poster image.
 */
export function HeroMediaSection({ media, onReplace }: HeroMediaSectionProps) {
  const heroVideo = media.find((m) => m.slotKey === "hero-video");
  const heroPoster = media.find((m) => m.slotKey === "hero-poster");

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Hero Section</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {heroVideo && <MediaCard media={heroVideo} onReplace={onReplace} />}
        {heroPoster && <MediaCard media={heroPoster} onReplace={onReplace} />}
      </div>
    </div>
  );
}
