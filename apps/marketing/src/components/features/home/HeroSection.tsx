"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn, useReducedMotion } from "@timber/ui";
import { ScrollIndicator } from "./ScrollIndicator";

// First frame of hero video - used as fallback while video loads
const HERO_IMAGE_SRC = "/hero/hero-poster.jpg";

export function HeroSection() {
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Reset video to beginning on mount (handles navigation back to homepage)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Reset state for new mount
      setVideoReady(false);

      // Reset to start
      video.currentTime = 0;

      // When video can play, show it and start playback
      const handleCanPlay = () => {
        video.currentTime = 0; // Ensure we're at frame 0
        setVideoReady(true);
        video.play().catch(() => {
          // Autoplay blocked - show fallback image
        });
      };

      // If video is already loaded (cached), handle immediately
      if (video.readyState >= 3) {
        handleCanPlay();
      } else {
        video.addEventListener("canplay", handleCanPlay, { once: true });
      }

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
      };
    }
  }, []);

  return (
    <section
      className="relative h-screen w-full overflow-hidden bg-charcoal"
      aria-label={t("heroSlogan")}
    >
      {/* Video/Image Background */}
      {reducedMotion ? (
        <Image
          src={HERO_IMAGE_SRC}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      ) : (
        <>
          {/* Fallback image - shown while video loads or if video fails */}
          <Image
            src={HERO_IMAGE_SRC}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          {/* Video - hidden until ready at frame 0 to prevent flash */}
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              // Hide video until it's ready at frame 0 to prevent flash
              videoReady ? "opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          >
            <source src="/hero/hero.mp4" type="video/mp4" />
          </video>
        </>
      )}

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 pt-32 md:pt-40">
        <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl text-white text-center max-w-4xl font-normal">
          {t("heroSlogan")}
        </h1>
        <p className="mt-4 text-xl md:text-2xl lg:text-3xl text-white/80 text-center">
          {t("heroSubtitle")}
        </p>
      </div>

      {/* Scroll Indicator */}
      <ScrollIndicator />
    </section>
  );
}
