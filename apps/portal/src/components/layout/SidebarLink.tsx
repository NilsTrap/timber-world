"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
};

export type IconName = keyof typeof ICON_MAP;

interface SidebarLinkProps {
  href: string;
  label: string;
  iconName: IconName;
  isCollapsed: boolean;
}

/**
 * Sidebar Navigation Link
 *
 * Displays an icon (always) and label (when expanded).
 * Highlights when the current route matches.
 */
export function SidebarLink({ href, label, iconName, isCollapsed }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ICON_MAP[iconName] || LayoutDashboard;

  return (
    <Link
      href={href}
      aria-label={isCollapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
        isCollapsed ? "justify-center" : "gap-3",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/60 hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}
