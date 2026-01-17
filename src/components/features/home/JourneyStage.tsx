"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { HorizontalGallery, type GalleryImage } from "./HorizontalGallery";

/**
 * Props for the JourneyStage component
 */
type JourneyStageProps = {
  /** Stage number (1-8) */
  stageNumber: number;
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
 */
export function JourneyStage({
  stageNumber,
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

  return (
    <div
      ref={stageRef}
      data-stage={stageNumber}
      id={`stage-${stageNumber}`}
      className="relative h-screen w-full snap-start snap-always overflow-hidden"
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
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* Content text - at bottom */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col items-center justify-end pb-24 px-6 text-center pointer-events-none ${
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
