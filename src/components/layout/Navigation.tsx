"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

interface NavigationProps {
  variant?: "transparent" | "solid";
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export function Navigation({
  variant = "solid",
  orientation = "horizontal",
  onNavigate,
}: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        orientation === "horizontal" ? "flex items-center gap-1" : "flex flex-col gap-2"
      )}
    >
      {siteConfig.navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors rounded-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              orientation === "vertical" && "text-lg py-3",
              variant === "transparent"
                ? cn(
                    "text-white/90 hover:text-white hover:bg-white/10",
                    isActive && "text-white bg-white/10"
                  )
                : cn(
                    "text-charcoal/80 hover:text-charcoal hover:bg-charcoal/5",
                    isActive && "text-forest-green bg-forest-green/5"
                  )
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
