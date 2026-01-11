"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

export function ScrollIndicator() {
  const t = useTranslations("home");
  const reducedMotion = useReducedMotion();

  return (
    <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
      <span className="text-sm text-white/80 font-medium">
        {t("scrollToExplore")}
      </span>
      <ChevronDown
        className={cn(
          "h-6 w-6 text-white",
          !reducedMotion && "animate-bounce"
        )}
        aria-hidden="true"
      />
    </div>
  );
}
