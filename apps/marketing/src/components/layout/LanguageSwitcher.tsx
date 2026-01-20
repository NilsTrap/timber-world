"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@timber/ui";
import { setCookie } from "@timber/utils/cookies";
import { locales, localeNames, localeFlags, type Locale } from "@timber/config/i18n";

interface LanguageSwitcherProps {
  variant?: "transparent" | "solid";
}

export function LanguageSwitcher({ variant = "solid" }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleLocaleChange = (newLocale: Locale) => {
    // Store locale preference in cookie (expires in 1 year)
    setCookie("NEXT_LOCALE", newLocale, 60 * 60 * 24 * 365);
    router.replace(pathname, { locale: newLocale });
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent, targetLocale: Locale) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleLocaleChange(targetLocale);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          variant === "transparent"
            ? "text-white/90 hover:text-white hover:bg-white/10"
            : "text-charcoal/80 hover:text-charcoal hover:bg-charcoal/5"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select language. Current: ${localeNames[locale]}`}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="uppercase">{locale}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select language"
          className={cn(
            "absolute right-0 z-50 mt-2 min-w-[180px] rounded-md border bg-white py-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {locales.map((loc) => (
            <li key={loc} role="option" aria-selected={loc === locale}>
              <button
                type="button"
                onClick={() => handleLocaleChange(loc)}
                onKeyDown={(e) => handleKeyDown(e, loc)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
                  "hover:bg-charcoal/5 focus-visible:bg-charcoal/5 focus-visible:outline-none",
                  loc === locale
                    ? "text-charcoal font-medium"
                    : "text-charcoal/70"
                )}
              >
                <span className="text-base" aria-hidden="true">
                  {localeFlags[loc]}
                </span>
                <span className="flex-1 text-left">{localeNames[loc]}</span>
                {loc === locale && (
                  <Check className="h-4 w-4 text-forest" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
