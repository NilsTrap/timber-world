"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Settings2, Package, ShoppingBag, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/catalog", label: "Categories", icon: LayoutGrid, match: (p: string) => p === "/admin/catalog" || (p.startsWith("/admin/catalog/") && !p.includes("/fields") && !p.includes("/packaging") && !p.includes("/products")) },
  { href: "/admin/catalog/products", label: "Products", icon: ShoppingBag, match: (p: string) => p.startsWith("/admin/catalog/products") },
  { href: "/admin/catalog/fields", label: "Fields", icon: Settings2, match: (p: string) => p.startsWith("/admin/catalog/fields") },
  { href: "/admin/catalog/packaging", label: "Packaging", icon: Package, match: (p: string) => p.startsWith("/admin/catalog/packaging") },
];

interface Props {
  children: React.ReactNode;
}

export function CatalogLayout({ children }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      {/* Sub-navigation */}
      <nav className="w-48 shrink-0 space-y-1 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
          Catalog
        </h2>
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
