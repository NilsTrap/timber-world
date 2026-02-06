"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@timber/ui";
import { ScrollIndicator } from "./ScrollIndicator";

const HERO_IMAGE_SRC = "/images/journey/forest.jpg";

export function HeroSection() {
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="relative h-screen w-full overflow-hidden"
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
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={HERO_IMAGE_SRC}
            className="absolute inset-0 h-full w-full object-cover z-0"
            aria-hidden="true"
            onCanPlay={(e) => {
              // Ensure video plays when ready
              const video = e.target as HTMLVideoElement;
              video.play().catch(() => {
                // Autoplay blocked - video will show poster
              });
            }}
          >
            <source src="/hero/hero.mp4" type="video/mp4" />
          </video>
          {/* Fallback image shown behind video (visible if video fails to load) */}
          <Image
            src={HERO_IMAGE_SRC}
            alt=""
            fill
            priority
            className="object-cover -z-10"
            sizes="100vw"
          />
        </>
      )}

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
        <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl text-white text-center max-w-4xl font-bold">
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
