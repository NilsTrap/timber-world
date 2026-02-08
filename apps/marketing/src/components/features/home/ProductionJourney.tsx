"use client";

import { useTranslations } from "next-intl";
import { JourneyStage } from "./JourneyStage";
import { JourneyCompletionCTA } from "./JourneyCompletionCTA";
import type { GalleryImage } from "./HorizontalGallery";

// Translation keys for stage names (matches i18n keys in messages/*.json)
const STAGE_KEYS = [
  "forest",
  "sawmill",
  "kiln",
  "factory",
  "workshop",
  "warehouse",
] as const;

// Substage keys for each stage (used to build gallery with translations)
const STAGE_SUBSTAGES: Record<string, string[]> = {
  forest: ["Maturing", "Harvesting", "Renewing"],
  sawmill: ["Grading", "Sawing", "Stacking"],
  kiln: ["Arranging", "Drying", "Protecting"],
  factory: ["Multisaw", "Opticut", "Planing", "FingerJointing", "Gluing", "Calibrating"],
  workshop: ["CNC", "Bonding", "Sanding", "Finishing", "Packaging"],
  warehouse: ["Controlling", "Storing", "Delivering", "Feedback"],
};

// Image paths for substages (only include if image exists)
// Format: stageKey-substageKey.jpg (lowercase)
const SUBSTAGE_IMAGES: Record<string, Record<string, string>> = {
  forest: {
    Maturing: "/images/journey/forest-maturing.jpg",
    Harvesting: "/images/journey/forest-harvesting.jpg",
    Renewing: "/images/journey/forest-renewing.jpg",
  },
  sawmill: {
    Grading: "/images/journey/sawmill-grading.jpg",
    Sawing: "/images/journey/sawmill-sawing.jpg",
    Stacking: "/images/journey/sawmill-stacking.jpg",
  },
  kiln: {
    Arranging: "/images/journey/kiln-arranging.jpg",
    Drying: "/images/journey/kiln-drying.jpg",
    Protecting: "/images/journey/kiln-protecting.jpg",
  },
  factory: {
    Multisaw: "/images/journey/factory-multisaw.jpg",
    Opticut: "/images/journey/factory-opticut.jpg",
    Planing: "/images/journey/factory-planing.jpg",
    FingerJointing: "/images/journey/factory-fingerjointing.jpg",
    Gluing: "/images/journey/factory-gluing.jpg",
    Calibrating: "/images/journey/factory-calibrating.jpg",
  },
  workshop: {
    CNC: "/images/journey/workshop-cnc.jpg",
    Bonding: "/images/journey/workshop-bonding.jpg",
    Sanding: "/images/journey/workshop-sanding.jpg",
    Finishing: "/images/journey/workshop-finishing.jpg",
    Packaging: "/images/journey/workshop-packaging.jpg",
  },
  warehouse: {
    Controlling: "/images/journey/warehouse-controlling.jpg",
    Storing: "/images/journey/warehouse-storing.jpg",
    Delivering: "/images/journey/warehouse-delivering.jpg",
    Feedback: "/images/journey/warehouse-feedback.jpg",
  },
};

/**
 * Production Journey - 6 full-screen stages with stacking cards effect.
 * Uses CSS scroll-snap for reliable section-by-section scrolling.
 * The scroll container is the parent element (page.tsx).
 */
export function ProductionJourney() {
  const t = useTranslations("home");

  return (
    <>
      {/* Journey stages with full-screen backgrounds - stacking cards effect */}
      {STAGE_KEYS.map((stageKey, i) => {
        // Build gallery images with translated substage titles and descriptions
        const substages = STAGE_SUBSTAGES[stageKey] || [];
        const stageImages = SUBSTAGE_IMAGES[stageKey] || {};
        const galleryImages: GalleryImage[] = substages.map((substageKey) => ({
          src: stageImages[substageKey], // undefined if no image = colored background fallback
          alt: t(`journey.${stageKey}${substageKey}`),
          title: t(`journey.${stageKey}${substageKey}`),
          description: t(`journey.${stageKey}${substageKey}Description`),
        }));

        return (
          <div key={i + 1} className="journey-snap-page">
            <JourneyStage
              stageNumber={i + 1}
              imageFallback={`/images/journey/${stageKey}.jpg`}
              galleryImages={galleryImages.length > 0 ? galleryImages : undefined}
              headline={t(`journey.${stageKey}`)}
              subtext={t(`journey.${stageKey}Description`)}
              altText={t("journey.stageAlt", {
                number: i + 1,
                name: t(`journey.${stageKey}`),
              })}
              priority={i === 0}
            />
          </div>
        );
      })}

      {/* CTA section after journey completion */}
      <div className="journey-snap-page">
        <JourneyCompletionCTA />
      </div>
    </>
  );
}
