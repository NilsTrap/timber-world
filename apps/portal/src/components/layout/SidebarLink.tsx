"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Factory,
  History,
  Boxes,
  Settings,
  User,
  Users,
  Users2,
  Building2,
  Truck,
  Shield,
  Eye,
  FileText,
  BarChart3,
  PoundSterling,
  Contact,
  ShoppingCart,
  Image,
  TrendingUp,
  Layers,
  ClipboardList,
  BookOpen,
  Handshake,
  Store,
  ChevronDown,
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
  Users,
  Users2,
  Building2,
  Truck,
  Shield,
  Eye,
  FileText,
  BarChart3,
  PoundSterling,
  Contact,
  ShoppingCart,
  Image,
  TrendingUp,
  Layers,
  ClipboardList,
  BookOpen,
  Handshake,
  Store,
};

export type IconName = keyof typeof ICON_MAP;

/** Visual grouping for colour-coding nav areas. Mirrors Sidebar's NavGroup. */
export type NavGroup = "agent" | "deals" | "settings";

/** Per-group colours: left accent bar + icon tint + (children) left border. */
const GROUP_BAR: Record<NavGroup, string> = {
  agent: "bg-amber-500",
  deals: "bg-emerald-500",
  settings: "bg-slate-400",
};
const GROUP_ICON: Record<NavGroup, string> = {
  agent: "text-amber-600",
  deals: "text-emerald-600",
  settings: "text-slate-500",
};
export const GROUP_CHILD_BORDER: Record<NavGroup, string> = {
  agent: "border-amber-500/40",
  deals: "border-emerald-500/40",
  settings: "border-slate-400/40",
};

interface SidebarLinkProps {
  href: string;
  label: string;
  iconName: IconName;
  isCollapsed: boolean;
  /** Optional badge count to display */
  badge?: number;
  /** Visual group for colour-coding. */
  group?: NavGroup;
}

/**
 * Sidebar Navigation Link
 *
 * Displays an icon (always) and label (when expanded).
 * Highlights when the current route matches.
 */
/** sessionStorage keys that store the last-visited sub-page for a route */
const LAST_ENTRY_KEYS: Record<string, string> = {
  "/production": "production-last-entry",
  "/shipments": "shipment-last-entry",
  "/admin/organisations": "organisation-last-entry",
  "/orders": "order-last-entry",
};

export function SidebarLink({ href, label, iconName, isCollapsed, badge, group }: SidebarLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Match exact path OR child routes (e.g., /shipments/[id] highlights /shipments)
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = ICON_MAP[iconName] || LayoutDashboard;

  // Preserve org filter when navigating between pages
  const orgParam = searchParams.get("org");
  const finalHref = orgParam ? `${href}?org=${orgParam}` : href;

  // If this route has a "last entry" stored, navigate directly there
  // (only when navigating from a DIFFERENT section, not when already on this section)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const storageKey = LAST_ENTRY_KEYS[href];
      if (storageKey && !pathname.startsWith(href)) {
        const lastEntry = sessionStorage.getItem(storageKey);
        if (lastEntry && lastEntry !== href) {
          e.preventDefault();
          router.push(lastEntry);
          return;
        }
      }
    },
    [href, router, pathname]
  );

  // Hover-only prefetch: Next's default Link prefetch eagerly fetches every
  // visible nav target on page load (~12-26 RSC fetches per dashboard hit).
  // Disabling default prefetch and prefetching on hover instead trades a
  // ~50-150ms first-click latency for ~10× less background server work.
  const handleMouseEnter = useCallback(() => {
    router.prefetch(finalHref);
  }, [router, finalHref]);

  return (
    <Link
      href={finalHref}
      prefetch={false}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onClick={handleClick}
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
      {group && (
        <span
          aria-hidden
          className={cn("absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r", GROUP_BAR[group])}
        />
      )}
      <Icon className={cn("h-5 w-5 shrink-0", group && !isActive ? GROUP_ICON[group] : undefined)} />
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

interface SidebarSectionHeaderProps {
  label: string;
  iconName: IconName;
  /** Whether the section is expanded (controls the chevron + content visibility). */
  isOpen: boolean;
  /** Whether any child route is currently active (tints the header). */
  isActive: boolean;
  group?: NavGroup;
  onClick: () => void;
}

/**
 * Expandable section header (e.g. "UK Agent app").
 *
 * Styled like a {@link SidebarLink} but it's a toggle button — it groups several
 * real sections under one collapsible parent instead of navigating itself.
 */
export function SidebarSectionHeader({
  label,
  iconName,
  isOpen,
  isActive,
  group,
  onClick,
}: SidebarSectionHeaderProps) {
  const Icon = ICON_MAP[iconName] || LayoutDashboard;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative",
        isActive
          ? "text-foreground font-medium"
          : "text-foreground/60 hover:bg-accent hover:text-foreground"
      )}
    >
      {group && (
        <span
          aria-hidden
          className={cn("absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r", GROUP_BAR[group])}
        />
      )}
      <Icon className={cn("h-5 w-5 shrink-0", group ? GROUP_ICON[group] : undefined)} />
      <span className="flex-1 text-left">{label}</span>
      <ChevronDown
        aria-hidden
        className={cn("h-4 w-4 shrink-0 transition-transform", isOpen ? "" : "-rotate-90")}
      />
    </button>
  );
}
