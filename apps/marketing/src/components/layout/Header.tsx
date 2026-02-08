"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { cn, Button, useScrolledPastHero, useScrollDirection } from "@timber/ui";
import { siteConfig } from "@timber/config/site";
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

  // On homepage, start with transparent and switch to solid after scrolling
  const isHomepage = pathname === "/";
  const variant = isHomepage
    ? scrolledPast
      ? "solid"
      : "transparent"
    : propVariant || "solid";

  // Hide navigation when scrolling down past the hero (for immersive journey experience)
  const shouldHideNav = isHomepage && scrolledPast && scrollDirection === "down";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        variant === "transparent"
          ? "bg-transparent text-white"
          : "bg-warm-cream text-charcoal border-b border-border",
        shouldHideNav && "opacity-0 pointer-events-none"
      )}
    >
      <div className="container mx-auto px-1">
        <div className="flex h-16 items-start justify-between md:h-20 pt-3">
          {/* Logo */}
          <Link
            href="/"
            className={cn(
              "flex items-center rounded-sm px-px py-px transition-all -ml-3",
              variant === "transparent"
                ? "bg-white/90 shadow-md"
                : ""
            )}
            aria-label={`${siteConfig.name} - Home`}
          >
            <Image
              src={siteConfig.logo.dark}
              alt={siteConfig.name}
              width={300}
              height={150}
              className="h-14 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-4 md:flex">
            <LanguageSwitcher variant={variant} />
            <Button
              asChild
              className={cn(
                "font-medium border-0",
                variant === "transparent"
                  ? "bg-forest-green/90 text-white hover:bg-forest-green"
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
                  ? "bg-white/90 text-forest-green hover:bg-white"
                  : "bg-white text-forest-green hover:bg-white/90 shadow-sm"
              )}
            >
              <Link href="/quote">{t("requestQuote")}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <MobileMenu variant={variant} />
          </div>
        </div>
      </div>
    </header>
  );
}
