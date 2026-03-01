"use client";

import { MediaCard } from "./MediaCard";
import { JOURNEY_STAGES, type MarketingMedia } from "../types";

interface JourneyMediaGridProps {
  media: MarketingMedia[];
  onReplace: (media: MarketingMedia) => void;
}

/**
 * JourneyMediaGrid
 *
 * Displays journey images grouped by stage (Forest, Sawmill, etc.)
 */
export function JourneyMediaGrid({ media, onReplace }: JourneyMediaGridProps) {
  // Group media by stage
  const mediaBySlotKey = new Map(media.map((m) => [m.slotKey, m]));

  return (
    <div className="space-y-8">
      {JOURNEY_STAGES.map((stage) => {
        // Get substage images
        const substageMedia = stage.substages
          .map((substage) => mediaBySlotKey.get(`${stage.key}-${substage}`))
          .filter(Boolean) as MarketingMedia[];

        // Get stage background image
        const stageBackground = mediaBySlotKey.get(stage.key);

        return (
          <div key={stage.key} className="space-y-3">
            <h3 className="text-lg font-semibold">{stage.label}</h3>

            {/* Main stage image first */}
            {stageBackground && (
              <div className="w-48">
                <MediaCard media={stageBackground} onReplace={onReplace} />
              </div>
            )}

            {/* Gallery images below */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {substageMedia.map((m) => (
                <MediaCard key={m.id} media={m} onReplace={onReplace} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
