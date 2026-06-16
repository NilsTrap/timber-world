"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Catalogue sub-section tabs.
 *
 * Categories / Products / Currencies used to be separate sidebar entries. They
 * now live as tabs on the Catalogue page so the sidebar keeps a single
 * "Catalogue" link under "UK Agent app" instead of a third nav level.
 *
 * Styled to match the `@timber/ui` Tabs primitive, but route-based (each tab is
 * a link to its own page so server-side data fetching per tab is preserved).
 * Hidden on drill-down routes (e.g. a category or product detail page), which
 * carry their own headers and back links.
 */
const TABS = [
  { href: "/admin/catalog", label: "Categories" },
  { href: "/admin/catalog/products", label: "Products" },
  { href: "/admin/catalog/currencies", label: "Currencies" },
];

export function CatalogTabs() {
  const pathname = usePathname();
  const isTabRoot = TABS.some((tab) => tab.href === pathname);
  if (!isTabRoot) return null;

  return (
    <nav
      aria-label="Catalogue sections"
      className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
