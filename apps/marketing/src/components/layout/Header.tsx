"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { cn, Button, useScrolledPastHero, useScrollDirection } from "@timber/ui";
import { siteConfig, currentBrand } from "@timber/config";
import { MobileMenu } from "./MobileMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  variant?: "transparent" | "solid";
}

export function Header({ variant: propVariant }: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const scrolledPast = useScrolledPastHero();
  const scrollDirection = useScrollDirection();

  // Track if we've completed initial render to enable transitions
  const [mounted, setMounted] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Enable transitions only after mount and a brief delay
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset mounted state briefly on navigation to prevent flash
  useEffect(() => {
    if (pathname !== prevPathname) {
      setMounted(false);
      setPrevPathname(pathname);
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, prevPathname]);

  // On homepage, start with transparent and switch to solid after scrolling
  const isHomepage = pathname === "/";
  const variant = isHomepage
    ? scrolledPast
      ? "solid"
      : "transparent"
    : propVariant || "solid";

  // Hide navigation buttons when scrolling down past the hero (for immersive journey experience)
  // But keep logo visible so users can always navigate home
  const shouldHideNav = isHomepage && scrolledPast && scrollDirection === "down";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-[100]",
        // Only enable transitions after mounted to prevent flash
        mounted ? "transition-all duration-300" : "transition-none",
        variant === "transparent"
          ? "bg-transparent text-white"
          : "bg-warm-cream text-charcoal border-b border-border",
        // Remove background when nav is hidden but header is still visible
        shouldHideNav && "bg-transparent border-transparent"
      )}
    >
      <div className="container mx-auto px-1">
        <div className="flex h-[72px] items-start justify-between md:h-24 pt-2 md:pt-3">
          {/* Logo */}
          <Link
            href="/"
            className={cn(
              "flex items-center rounded-sm px-px py-px transition-all -ml-3 cursor-pointer",
              // Show white background when on transparent header OR during journey (when nav is hidden)
              (variant === "transparent" || shouldHideNav)
                ? "bg-white/70 shadow-md"
                : ""
            )}
            aria-label={`${siteConfig.name} - Home`}
            onClick={() => {
              // Scroll to top when clicking logo (especially useful on homepage during journey)
              // The journey page uses a custom scroll container, so we need to scroll it instead of window
              const journeyContainer = document.querySelector('.journey-scroll-container');
              if (journeyContainer) {
                journeyContainer.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <Image
              src={siteConfig.logo.dark}
              alt={siteConfig.name}
              width={600}
              height={300}
              className={cn(
                "pointer-events-none select-none",
                currentBrand.key === "timber"
                  ? "h-[64px] md:h-[80px] w-auto"  // 20% smaller on mobile
                  : "h-[120px] md:h-[148px] w-auto"
              )}
              priority
              draggable={false}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className={cn(
            "hidden items-center gap-4 md:flex",
            mounted ? "transition-opacity duration-300" : "transition-none",
            shouldHideNav && "opacity-0 pointer-events-none"
          )}>
            <LanguageSwitcher variant={variant} />
            <Button
              asChild
              className={cn(
                "font-medium border-0",
                variant === "transparent"
                  ? "bg-forest-green/70 text-white hover:bg-forest-green"
                  : "bg-forest-green text-white hover:bg-forest-green/90"
              )}
            >
              <Link href="/products">{t("viewProducts")}</Link>
            </Button>
            <Button
              asChild
              className={cn(
                "font-medium border-0",
                variant === "transparent"
                  ? "bg-white/70 text-forest-green hover:bg-white"
                  : "bg-white text-forest-green hover:bg-white/90 shadow-sm"
              )}
            >
              <Link href="/quote">{t("requestQuote")}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className={cn(
            "md:hidden",
            mounted ? "transition-opacity duration-300" : "transition-none",
            shouldHideNav && "opacity-0 pointer-events-none"
          )}>
            <MobileMenu variant={variant} />
          </div>
        </div>
      </div>
    </header>
  );
}
