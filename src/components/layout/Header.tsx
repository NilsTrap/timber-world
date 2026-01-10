"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  variant?: "transparent" | "solid";
}

export function Header({ variant = "solid" }: HeaderProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        variant === "transparent"
          ? "bg-transparent text-white"
          : "bg-warm-cream text-charcoal border-b border-border"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between md:h-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-heading text-xl font-semibold"
            aria-label={`${siteConfig.name} - Home`}
          >
            {siteConfig.name}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-6 md:flex">
            <Navigation variant={variant} />
            <LanguageSwitcher variant={variant} />
            <Button
              asChild
              className={cn(
                "font-medium",
                variant === "transparent"
                  ? "bg-white text-forest-green hover:bg-white/90"
                  : "bg-forest-green text-white hover:bg-forest-green/90"
              )}
            >
              <Link href="/quote">Request Quote</Link>
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
