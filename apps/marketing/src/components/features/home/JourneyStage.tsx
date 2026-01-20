"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "@timber/ui";
import { HorizontalGallery, type GalleryImage } from "./HorizontalGallery";

/**
 * Props for the JourneyStage component
 */
type JourneyStageProps = {
  /** Stage number (1-8) */
  stageNumber: number;
  /** Total number of stages */
  totalStages: number;
  /** Optional path to micro-video (WebM format preferred) */
  videoSrc?: string;
  /** Optional path to MP4 fallback (defaults to videoSrc with .mp4 extension) */
  videoSrcMp4?: string;
  /** Required path to fallback image */
  imageFallback: string;
  /** Optional additional gallery images (renders HorizontalGallery when provided) */
  galleryImages?: GalleryImage[];
  /** Translated headline text */
  headline: string;
  /** Translated expertise/description text */
  subtext: string;
  /** Translated alt text for accessibility */
  altText: string;
  /** Whether to prioritize loading this image (true for first stage) */
  priority?: boolean;
};

/**
 * JourneyStage - A full-screen production journey stage with background media,
 * gradient overlay, and scroll-triggered content animations.
 * Uses stacking cards effect where each stage slides over the previous.
 */
export function JourneyStage({
  stageNumber,
  totalStages,
  videoSrc,
  videoSrcMp4,
  imageFallback,
  galleryImages,
  headline,
  subtext,
  altText,
  priority = false,
}: JourneyStageProps) {
  const [isInView, setIsInView] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!stageRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const showVideo = videoSrc && !reducedMotion && !videoError && !galleryImages;

  const allGalleryImages: GalleryImage[] = galleryImages
    ? [{ src: imageFallback, alt: altText }, ...galleryImages]
    : [];
  const showGallery = allGalleryImages.length > 1;

  // Calculate sticky top position - each stage sticks slightly lower
  // This creates the "peeking" effect where you can see the edge of previous stages
  const stickyTop = 0;

  // Calculate bottom value for sticky - this determines when it unsticks
  // Last stage should not unstick, others unstick when their "slot" is filled
  const isLastStage = stageNumber === totalStages;

  return (
    <div
      ref={stageRef}
      data-stage={stageNumber}
      id={`stage-${stageNumber}`}
      className="stack-card h-screen w-full overflow-hidden shadow-2xl"
      style={{
        zIndex: stageNumber * 10,
        top: stickyTop,
        // Use bottom to control when element unsticks (negative value keeps it stuck longer)
        bottom: isLastStage ? 'auto' : `-${(totalStages - stageNumber) * 100}vh`,
      }}
    >
      {/* Background Image/Video - only when NOT showing gallery */}
      {!showGallery && (
        <div className="absolute inset-0">
          {showVideo ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoError(true)}
              className="h-full w-full object-cover"
              aria-hidden="true"
            >
              <source src={videoSrc} type="video/webm" />
              <source
                src={videoSrcMp4 ?? videoSrc?.replace(/\.webm$/i, ".mp4")}
                type="video/mp4"
              />
            </video>
          ) : (
            <Image
              src={imageFallback}
              alt={altText}
              fill
              className="object-cover"
              priority={priority}
              sizes="100vw"
            />
          )}
        </div>
      )}

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 z-[35] pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* Content text - at bottom */}
      <div
        className={`absolute inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end pb-24 px-6 text-center pointer-events-none ${
          reducedMotion ? "" : "transition-all duration-[400ms] ease-out"
        } ${
          isInView || reducedMotion
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }`}
      >
        <h2 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-lg">
          {headline}
        </h2>
        <p className="text-lg md:text-xl text-white/80 max-w-2xl drop-shadow-md">
          {subtext}
        </p>
      </div>

      {/* Gallery - rendered LAST so it's on top and can receive events */}
      {showGallery && (
        <div className="absolute inset-0 z-30">
          <HorizontalGallery
            images={allGalleryImages}
            galleryLabel={`${headline} gallery`}
            showCounter={true}
          />
        </div>
      )}
    </div>
  );
}
