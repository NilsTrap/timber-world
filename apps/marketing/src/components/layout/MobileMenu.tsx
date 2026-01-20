"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Menu, X } from "lucide-react";
import { cn, Button } from "@timber/ui";
import { siteConfig } from "@timber/config/site";
import { Navigation } from "./Navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface MobileMenuProps {
  variant?: "transparent" | "solid";
}

export function MobileMenu({ variant = "solid" }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations();

  const openMenu = useCallback(() => {
    setIsAnimating(true);
    setIsOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const closeMenu = useCallback(() => {
    setIsAnimating(true);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsOpen(false);
      setIsAnimating(false);
      document.body.style.overflow = "";
      // Return focus to trigger button
      triggerRef.current?.focus();
    }, 200);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeMenu]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when menu opens
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    menu.addEventListener("keydown", handleTabKey);
    return () => menu.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      {/* Menu Toggle Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        className={cn(
          "p-2 rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          variant === "transparent"
            ? "text-white hover:bg-white/10"
            : "text-charcoal hover:bg-charcoal/5"
        )}
        aria-label={t("mobileMenu.openMenu")}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Full-screen Overlay Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          id="mobile-menu"
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-warm-cream",
            "transition-opacity duration-200 ease-in-out",
            isAnimating && !isOpen ? "opacity-0" : "opacity-100"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          {/* Header with close button */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link
              href="/"
              onClick={closeMenu}
              className="font-heading text-xl font-semibold text-charcoal"
            >
              {siteConfig.name}
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              className={cn(
                "p-2 rounded-md text-charcoal transition-colors",
                "hover:bg-charcoal/5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-label={t("mobileMenu.closeMenu")}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Menu Content */}
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {/* Navigation Links */}
            <Navigation
              variant="solid"
              orientation="vertical"
              onNavigate={closeMenu}
            />

            {/* Language Switcher */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                {t("mobileMenu.language")}
              </p>
              <LanguageSwitcher variant="solid" />
            </div>

            {/* CTA Button */}
            <div className="mt-auto pt-6">
              <Button
                asChild
                className="w-full bg-forest-green text-white hover:bg-forest-green/90"
                size="lg"
              >
                <Link href="/quote" onClick={closeMenu}>
                  {t("nav.requestQuote")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
