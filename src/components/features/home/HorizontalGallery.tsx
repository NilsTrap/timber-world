"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Gallery image type
 */
export type GalleryImage = {
  src: string;
  alt: string;
};

/**
 * Props for HorizontalGallery component
 */
type HorizontalGalleryProps = {
  /** Array of images to display in the gallery */
  images: GalleryImage[];
  /** Show "2 of 6" counter (default: true) */
  showCounter?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Gallery label for accessibility (stage name) */
  galleryLabel?: string;
};

/**
 * HorizontalGallery - A swipeable horizontal image gallery for journey stages.
 */
export function HorizontalGallery({
  images,
  showCounter = true,
  className = "",
  galleryLabel = "Image gallery",
}: HorizontalGalleryProps) {
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Track drag state
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    currentX: 0,
  });

  // Gap detection for wheel events (same approach as vertical scrolling)
  const lastWheelTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // Add non-passive event listeners for wheel and touchmove to enable preventDefault
  // Use capture phase to intercept before browser processes the gesture
  useEffect(() => {
    const element = galleryRef.current;
    if (!element) return;

    const handleWheelNative = (e: WheelEvent) => {
      // Check if event is within our gallery
      if (!element.contains(e.target as Node)) return;

      // Only handle horizontal scrolling
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const now = performance.now();
        const timeSinceLastEvent = now - lastWheelTimeRef.current;
        lastWheelTimeRef.current = now;

        // Gap detected = new gesture, allow new image move
        if (timeSinceLastEvent > 40) {
          hasMovedRef.current = false;
        }

        // Move image on first significant delta of each gesture
        if (!hasMovedRef.current && Math.abs(e.deltaX) > 5) {
          hasMovedRef.current = true;
          if (e.deltaX > 0) {
            setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
          } else {
            setCurrentIndex((prev) => Math.max(prev - 1, 0));
          }
        }
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (!element.contains(e.target as Node)) return;
      if (!dragState.current.isDragging) return;
      const touch = e.touches[0];
      if (touch) {
        const deltaX = Math.abs(touch.clientX - dragState.current.startX);
        if (deltaX > 10) {
          e.preventDefault();
          e.stopPropagation();
        }
        dragState.current.currentX = touch.clientX;
      }
    };

    // Add to document with capture phase to intercept early
    document.addEventListener("wheel", handleWheelNative, { passive: false, capture: true });
    document.addEventListener("touchmove", handleTouchMoveNative, { passive: false, capture: true });

    return () => {
      document.removeEventListener("wheel", handleWheelNative, { capture: true });
      document.removeEventListener("touchmove", handleTouchMoveNative, { capture: true });
    };
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Check if event target is a button
  const isButtonClick = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return target.closest("button") !== null;
  };

  // Touch handlers for swipe (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isButtonClick(e.target)) return;
    const touch = e.touches[0];
    if (touch) {
      dragState.current = {
        isDragging: true,
        startX: touch.clientX,
        currentX: touch.clientX,
      };
    }
  };

  const handleTouchMove = () => {
    // Touch move is handled by native event listener for preventDefault support
  };

  const handleTouchEnd = () => {
    if (!dragState.current.isDragging) return;
    const { startX, currentX } = dragState.current;
    const distance = startX - currentX;
    const minSwipeDistance = 30; // Reduced for easier swiping

    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrevious();
    }

    dragState.current.isDragging = false;
  };

  // Mouse handlers for desktop drag/swipe
  const handleMouseDown = (e: React.MouseEvent) => {
    // Focus the gallery for keyboard navigation (preventScroll to avoid instant snap)
    galleryRef.current?.focus({ preventScroll: true });

    if (isButtonClick(e.target)) return;
    // Don't preventDefault here - let click events work normally for smooth scroll
    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      currentX: e.clientX,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.isDragging) return;
    // Only prevent default when actually dragging (moving)
    const deltaX = Math.abs(e.clientX - dragState.current.startX);
    if (deltaX > 5) {
      e.preventDefault();
    }
    dragState.current.currentX = e.clientX;
  };

  const handleMouseUp = () => {
    if (!dragState.current.isDragging) return;
    const { startX, currentX } = dragState.current;
    const distance = startX - currentX;
    const minSwipeDistance = 30; // Reduced for easier swiping

    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrevious();
    }

    dragState.current.isDragging = false;
  };

  const handleMouseLeave = () => {
    dragState.current.isDragging = false;
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      goToNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      goToPrevious();
    }
  };

  // Button click handlers with stopPropagation
  const handlePrevClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToPrevious();
  };

  const handleNextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToNext();
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    goToIndex(index);
  };

  // Don't render gallery controls if only 1 image
  if (images.length <= 1) {
    const singleImage = images[0];
    if (!singleImage) return null;
    return (
      <Image
        src={singleImage.src}
        alt={singleImage.alt}
        fill
        className="object-cover"
        sizes="100vw"
      />
    );
  }

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex === images.length - 1;

  return (
    <div
      ref={galleryRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={galleryLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ touchAction: "pan-y", overscrollBehaviorX: "contain" }}
      className={`relative w-full h-full outline-none focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:ring-inset cursor-grab active:cursor-grabbing ${className}`}
    >
      {/* Images container - sliding carousel */}
      <div className="relative w-full h-full overflow-hidden select-none">
        <div
          className={`flex h-full ${
            reducedMotion ? "" : "transition-transform duration-500 ease-out"
          }`}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className="relative w-full h-full flex-shrink-0"
              aria-hidden={index !== currentIndex}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover pointer-events-none"
                sizes="100vw"
                priority={index === 0}
                unoptimized={image.src.startsWith("http")}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t("journey.imageOf", { current: currentIndex + 1, total: images.length })}
      </div>

      {/* Left Arrow */}
      {!isAtStart && (
        <button
          type="button"
          onClick={handlePrevClick}
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
          onClick={handleNextClick}
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

      {/* Counter */}
      {showCounter && (
        <div className="absolute top-4 right-4 z-30 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium pointer-events-none">
          {t("journey.imageOf", { current: currentIndex + 1, total: images.length })}
        </div>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={(e) => handleDotClick(e, index)}
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
