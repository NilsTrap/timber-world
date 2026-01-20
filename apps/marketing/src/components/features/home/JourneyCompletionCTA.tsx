"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "@timber/ui";

/**
 * JourneyCompletionCTA - Full-screen call-to-action section displayed after
 * the 8 production journey stages. Provides clear paths to products and quotes.
 *
 * Features:
 * - Full-screen section with background image and gradient overlay
 * - Two prominent CTA buttons: View Products and Request Quote
 * - Scroll-triggered fade-in animation with staggered buttons
 * - Keyboard accessible with visible focus states
 * - Reduced motion support
 * - Fully internationalized
 */
export function JourneyCompletionCTA() {
  const locale = useLocale();
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // IntersectionObserver for scroll-triggered animation
  useEffect(() => {
    if (!sectionRef.current) return;

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

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const baseButtonClasses = reducedMotion
    ? ""
    : "transition-all duration-[600ms] ease-out";

  const animationClasses =
    isInView || reducedMotion
      ? "opacity-100 translate-y-0"
      : "opacity-0 translate-y-4";

  return (
    <section
      ref={sectionRef}
      id="journey-cta"
      className="stack-card h-screen w-full overflow-hidden flex items-center justify-center shadow-2xl"
      style={{ zIndex: 90 }}
    >
        {/* Background Image - using forest image for continuity */}
        <div className="absolute inset-0">
          <Image
            src="/images/journey/forest.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            aria-hidden="true"
          />
        </div>

        {/* Gradient Overlay - darker for better button contrast */}
        <div className="absolute inset-0 z-10 bg-black/60" aria-hidden="true" />

        {/* Content Container */}
        <div
          className={`relative z-20 flex flex-col items-center justify-center px-6 text-center max-w-3xl ${baseButtonClasses} ${animationClasses}`}
        >
          {/* Headline */}
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            {t("journey.ctaHeadline")}
          </h2>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-white/90 mb-10 drop-shadow-md max-w-xl">
            {t("journey.ctaSubtext")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Primary Button - View Products (Forest Green bg, white text, 48px height) */}
            <Link
              href={`/${locale}/products`}
              className={`
                inline-flex items-center justify-center
                px-8 h-12 min-w-[200px]
                bg-[#1B4332] hover:bg-[#143728]
                text-white font-semibold text-lg
                rounded-lg
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                ${reducedMotion ? "" : "transition-all duration-200 hover:scale-105"}
                ${animationClasses}
                ${reducedMotion ? "" : "delay-100"}
              `}
            >
              {t("journey.viewProducts")}
            </Link>

            {/* Secondary Button - Request Quote (White bg, Forest Green border/text, 48px height) */}
            <Link
              href={`/${locale}/quote`}
              className={`
                inline-flex items-center justify-center
                px-8 h-12 min-w-[200px]
                bg-white hover:bg-gray-100
                border-2 border-[#1B4332]
                text-[#1B4332] font-semibold text-lg
                rounded-lg
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4332] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                ${reducedMotion ? "" : "transition-all duration-200 hover:scale-105"}
                ${animationClasses}
                ${reducedMotion ? "" : "delay-200"}
              `}
            >
              {t("journey.requestQuote")}
            </Link>
          </div>
        </div>
      </section>
  );
}
