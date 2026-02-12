"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@timber/ui";

/**
 * Gallery image type
 */
export type GalleryImage = {
  /** Image source URL (optional - if not provided, shows colored background) */
  src?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional title to display on the slide */
  title?: string;
  /** Optional description to display below title */
  description?: string;
};

/**
 * Props for HorizontalGallery component
 */
type HorizontalGalleryProps = {
  /** Array of images to display in the gallery */
  images: GalleryImage[];
  /** Additional CSS classes */
  className?: string;
  /** Gallery label for accessibility (stage name) */
  galleryLabel?: string;
  /** Callback when a slide is viewed */
  onSlideView?: (slideIndex: number, slideTitle?: string) => void;
  /** Callback when leaving a slide with time spent */
  onSlideExit?: (slideIndex: number, timeSpentMs: number, slideTitle?: string) => void;
};

/**
 * HorizontalGallery - A swipeable horizontal image gallery using CSS scroll-snap.
 * No JavaScript gesture handling - browser handles all scrolling natively.
 */
export function HorizontalGallery({
  images,
  className = "",
  galleryLabel = "Image gallery",
  onSlideView,
  onSlideExit,
}: HorizontalGalleryProps) {
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasVisibleRef = useRef(true);
  const slideStartTimeRef = useRef<number>(Date.now());
  const trackedSlidesRef = useRef<Set<number>>(new Set());

  // Track current slide via scroll position
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const handleScroll = () => {
      const scrollLeft = gallery.scrollLeft;
      const slideWidth = gallery.offsetWidth;
      const newIndex = Math.round(scrollLeft / slideWidth);
      setCurrentIndex(newIndex);
    };

    gallery.addEventListener("scroll", handleScroll, { passive: true });
    return () => gallery.removeEventListener("scroll", handleScroll);
  }, []);

  // Track slide changes - view and time spent
  useEffect(() => {
    const currentImage = images[currentIndex];

    // Track time spent on previous slide when index changes
    if (onSlideExit && slideStartTimeRef.current) {
      // This runs when currentIndex changes, so we're exiting the previous slide
      // We'll track the exit in the next render cycle
    }

    // Track slide view (deduplicated)
    if (onSlideView && !trackedSlidesRef.current.has(currentIndex)) {
      trackedSlidesRef.current.add(currentIndex);
      onSlideView(currentIndex, currentImage?.title);
    }

    // Reset timer for current slide
    slideStartTimeRef.current = Date.now();
  }, [currentIndex, images, onSlideView]);

  // Track time spent on slide when leaving (cleanup effect)
  useEffect(() => {
    const prevIndex = currentIndex;
    const prevImage = images[prevIndex];
    const startTime = slideStartTimeRef.current;

    return () => {
      if (onSlideExit && startTime) {
        const timeSpent = Date.now() - startTime;
        // Only track if spent more than 500ms (avoid tracking quick swipes)
        if (timeSpent > 500) {
          onSlideExit(prevIndex, timeSpent, prevImage?.title);
        }
      }
    };
  }, [currentIndex, images, onSlideExit]);

  // Reset to first slide when gallery goes fully out of view
  useEffect(() => {
    const container = containerRef.current;
    const gallery = galleryRef.current;
    if (!container || !gallery) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const isVisible = entry.isIntersecting;

        // Only reset when transitioning from visible to not visible
        if (wasVisibleRef.current && !isVisible) {
          // Gallery just went out of view - reset instantly
          gallery.scrollTo({ left: 0, behavior: "auto" });
          setCurrentIndex(0);
        }

        wasVisibleRef.current = isVisible;
      },
      { threshold: 0.5 } // Must be at least 50% out of view
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const slideWidth = gallery.offsetWidth;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      gallery.scrollBy({ left: slideWidth, behavior: reducedMotion ? "auto" : "smooth" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      gallery.scrollBy({ left: -slideWidth, behavior: reducedMotion ? "auto" : "smooth" });
    }
  };

  // Navigate to specific slide
  const goToSlide = (index: number) => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const slideWidth = gallery.offsetWidth;
    gallery.scrollTo({ left: index * slideWidth, behavior: reducedMotion ? "auto" : "smooth" });
  };

  // Don't render gallery if only 1 image
  if (images.length <= 1) {
    const singleImage = images[0];
    if (!singleImage) return null;
    return (
      <div className="relative w-full h-full">
        {singleImage.src ? (
          <Image
            src={singleImage.src}
            alt={singleImage.alt}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#1B4332] to-[#2D3436]"
            aria-hidden="true"
          />
        )}
        {(singleImage.title || singleImage.description) && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
              }}
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end pb-24 px-6 text-center pointer-events-none">
              {singleImage.title && (
                <h3 className="font-heading text-2xl md:text-4xl lg:text-5xl font-normal text-white mb-3 drop-shadow-lg">
                  {singleImage.title}
                </h3>
              )}
              {singleImage.description && (
                <p className="text-lg md:text-xl lg:text-2xl text-white/80 max-w-2xl drop-shadow-md">
                  {singleImage.description}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex === images.length - 1;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={galleryLabel}
    >
      {/* Scrollable gallery container - CSS scroll-snap handles everything */}
      <div
        ref={galleryRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="gallery-scroll-container flex w-full h-full outline-none focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:ring-inset"
      >
        {images.map((image, index) => (
          <div
            key={index}
            className="gallery-snap-slide relative"
            aria-hidden={index !== currentIndex}
          >
            {/* Background: Image or colored fallback */}
            {image.src ? (
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="100vw"
                priority={index === 0}
                unoptimized={image.src.startsWith("http")}
                draggable={false}
              />
            ) : (
              <div
                className="absolute inset-0 bg-gradient-to-br from-[#1B4332] to-[#2D3436]"
                aria-hidden="true"
              />
            )}

            {/* Gradient overlay for text readability */}
            {(image.title || image.description) && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
                }}
                aria-hidden="true"
              />
            )}

            {/* Title and description overlay */}
            {(image.title || image.description) && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end pb-24 px-6 text-center pointer-events-none">
                {image.title && (
                  <h3 className="font-heading text-2xl md:text-4xl lg:text-5xl font-normal text-white mb-3 drop-shadow-lg">
                    {image.title}
                  </h3>
                )}
                {image.description && (
                  <p className="text-lg md:text-xl lg:text-2xl text-white/80 max-w-2xl drop-shadow-md">
                    {image.description}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t("journey.imageOf", { current: currentIndex + 1, total: images.length })}
      </div>

      {/* Left Arrow */}
      {!isAtStart && (
        <button
          type="button"
          onClick={() => goToSlide(currentIndex - 1)}
          aria-label={t("journey.previousImage")}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer ${
            reducedMotion ? "" : "transition-all duration-200 hover:scale-110"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
      )}

      {/* Right Arrow */}
      {!isAtEnd && (
        <button
          type="button"
          onClick={() => goToSlide(currentIndex + 1)}
          aria-label={t("journey.nextImage")}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer ${
            reducedMotion ? "" : "transition-all duration-200 hover:scale-110"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      )}


      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={t("journey.goToImage", { number: index + 1 })}
            aria-current={index === currentIndex ? "true" : undefined}
            className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
              reducedMotion ? "" : "transition-all duration-200"
            } ${
              index === currentIndex
                ? "bg-white scale-110"
                : "bg-white/50 hover:bg-white/75"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50`}
          />
        ))}
      </div>
    </div>
  );
}
