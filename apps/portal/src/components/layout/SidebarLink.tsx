"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Factory,
  History,
  Boxes,
  Settings,
  User,
  Building2,
  Truck,
  Shield,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon name to component mapping
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Factory,
  History,
  Boxes,
  Settings,
  User,
  Building2,
  Truck,
  Shield,
  Eye,
};

export type IconName = keyof typeof ICON_MAP;

interface SidebarLinkProps {
  href: string;
  label: string;
  iconName: IconName;
  isCollapsed: boolean;
  /** Optional badge count to display */
  badge?: number;
}

/**
 * Sidebar Navigation Link
 *
 * Displays an icon (always) and label (when expanded).
 * Highlights when the current route matches.
 */
export function SidebarLink({ href, label, iconName, isCollapsed, badge }: SidebarLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Exact match only - don't highlight parent routes when on child pages
  const isActive = pathname === href;
  const Icon = ICON_MAP[iconName] || LayoutDashboard;

  // Preserve org filter when navigating between pages
  const orgParam = searchParams.get("org");
  const finalHref = orgParam ? `${href}?org=${orgParam}` : href;

  return (
    <Link
      href={finalHref}
      aria-label={isCollapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative",
        isCollapsed ? "justify-center" : "gap-3",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/60 hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span className="flex-1">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium",
            isCollapsed
              ? "absolute -top-1 -right-1 h-4 min-w-[16px] px-1"
              : "h-5 min-w-[20px] px-1.5"
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
