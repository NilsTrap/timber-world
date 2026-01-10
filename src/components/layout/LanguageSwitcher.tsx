"use client";

import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

interface LanguageSwitcherProps {
  variant?: "transparent" | "solid";
}

/**
 * Language switcher placeholder component.
 * Will be fully implemented in Story 5.5 when i18n infrastructure is complete.
 */
export function LanguageSwitcher({ variant = "solid" }: LanguageSwitcherProps) {
  const currentLocale = siteConfig.defaultLocale;

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        variant === "transparent"
          ? "text-white/90 hover:text-white hover:bg-white/10"
          : "text-charcoal/80 hover:text-charcoal hover:bg-charcoal/5"
      )}
      aria-label={`Current language: ${currentLocale.toUpperCase()}. Language selection coming soon.`}
      disabled
    >
      <Globe className="h-4 w-4" aria-hidden="true" />
      <span className="uppercase">{currentLocale}</span>
    </button>
  );
}
