"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@timber/ui";
import { cn } from "@/lib/utils";
import { SidebarLink, SidebarSectionHeader, GROUP_CHILD_BORDER, type IconName, type NavGroup as LinkNavGroup } from "./SidebarLink";
import { OrganizationSelector, type OrganizationOption } from "./OrganizationSelector";
import {
  OrganizationSwitcher,
  type OrganizationSwitcherOption,
} from "./OrganizationSwitcher";
import { logoutUser } from "@/features/auth/actions";
import { getPendingShipmentCount } from "@/features/shipments/actions/getOrgShipments";

/**
 * Visual grouping for nav items. Used to colour-code distinct areas of the
 * system so it's clear at a glance what belongs to the agent shop vs the new
 * deals workflow vs the rest. `undefined` = the default (core system) group.
 */
export type NavGroup = "agent" | "deals" | "settings";

/**
 * Sub-navigation item.
 *
 * - For a normal parent (e.g. Settings) these render as small text links shown
 *   only when the parent route is active; `iconName` is omitted.
 * - For a `collapsible` section (e.g. "UK Agent app") each child is a real
 *   section rendered as a full {@link SidebarLink}; `iconName` is required.
 */
export interface NavChild {
  href: string;
  label: string;
  iconName?: IconName;
}

/**
 * Navigation Item Type
 */
export interface NavItem {
  href: string;
  label: string;
  iconName: IconName;
  /** Optional badge count to display */
  badge?: number;
  /** Sub-navigation items (shown when parent is active) */
  children?: NavChild[];
  /** Visual group for colour-coding (agent shop, deals, …). */
  group?: NavGroup;
  /**
   * Render as an expandable section header instead of a link. The `children`
   * are full nav links (each with its own `iconName`), collapsed/expanded
   * under one parent (e.g. "UK Agent app"). `href` is used only as a key.
   */
  collapsible?: boolean;
}

interface SidebarProps {
  navItems: NavItem[];
  brandName: string;
  /** Organizations for Super Admin selector (omit for regular users) */
  organizations?: OrganizationOption[];
  /** Current organization for multi-org users */
  currentOrganization?: OrganizationSwitcherOption | null;
  /** All organization memberships for multi-org users */
  userMemberships?: OrganizationSwitcherOption[];
  /** Whether user has multiple organization memberships */
  hasMultipleOrgs?: boolean;
  /** Whether to load pending shipment badge count client-side */
  loadShipmentBadge?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/**
 * Collapsible Sidebar Navigation
 *
 * Left sidebar that can be collapsed to show only icons.
 * Collapse state is persisted to localStorage.
 */
export function Sidebar({
  navItems,
  brandName,
  organizations,
  currentOrganization,
  userMemberships = [],
  hasMultipleOrgs = false,
  loadShipmentBadge = false,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [shipmentBadge, setShipmentBadge] = useState(0);
  const searchParams = useSearchParams();

  // Get current orgs from URL for OrganizationSelector (comma-separated)
  const orgParam = searchParams.get("org");
  const currentOrgIds = orgParam ? orgParam.split(",").filter(Boolean) : [];

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
    setIsMounted(true);
  }, []);

  // Load pending shipment count asynchronously (doesn't block page render)
  useEffect(() => {
    if (!loadShipmentBadge) return;
    getPendingShipmentCount().then((result) => {
      if (result.success && result.data > 0) {
        setShipmentBadge(result.data);
      }
    });
  }, [loadShipmentBadge]);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
  };

  // Prevent hydration mismatch
  if (!isMounted) {
    return (
      <aside className="flex h-screen w-64 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-semibold text-lg">{brandName}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex items-center overflow-hidden"
          aria-label="Go to dashboard"
        >
          {isCollapsed ? (
            <span className="text-xl font-bold text-primary">
              {brandName.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <span className="font-semibold text-lg whitespace-nowrap truncate">
              {brandName}
            </span>
          )}
        </Link>
      </div>

      {/* Organization Switcher for multi-org users (Story 10.7) */}
      {userMemberships.length > 1 && (
        <div className="border-b">
          <OrganizationSwitcher
            currentOrganization={currentOrganization ?? null}
            memberships={userMemberships}
            isCollapsed={isCollapsed}
          />
        </div>
      )}

      {/* Organization Selector (Super Admin only) */}
      {organizations && organizations.length > 0 && !hasMultipleOrgs && (
        <div className="border-b relative">
          <OrganizationSelector
            organizations={organizations}
            currentOrgIds={currentOrgIds}
            isCollapsed={isCollapsed}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Main navigation">
        <ul className="space-y-1">
          {navItems.map((item) =>
            item.collapsible ? (
              <li key={item.href}>
                <SidebarSection item={item} isCollapsed={isCollapsed} />
              </li>
            ) : (
              <li key={item.href}>
                <SidebarLink
                  href={item.href}
                  label={item.label}
                  iconName={item.iconName}
                  isCollapsed={isCollapsed}
                  badge={item.href === "/shipments" ? shipmentBadge : item.badge}
                  group={item.group}
                />
                {item.children && !isCollapsed && (
                  <SidebarChildren parentHref={item.href} children={item.children} group={item.group} />
                )}
              </li>
            )
          )}
        </ul>
      </nav>

      {/* Footer - Profile & Logout */}
      <div className="border-t p-2 space-y-1">
        <SidebarLink
          href="/profile"
          label="Profile"
          iconName="User"
          isCollapsed={isCollapsed}
        />
        <form action={logoutUser}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
              "text-foreground/60 hover:bg-accent hover:text-foreground",
              isCollapsed ? "justify-center" : "gap-3"
            )}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </form>
      </div>

      {/* Collapse Toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className={cn("w-full", isCollapsed ? "px-0" : "")}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

const SECTION_OPEN_PREFIX = "sidebar-section-open:";

/**
 * Collapsible nav section (e.g. "UK Agent app").
 *
 * Groups several real sections under one expandable parent. Open/closed state is
 * persisted to localStorage (default open) and force-opened whenever a child
 * route is active. When the whole sidebar is collapsed to the icon rail, the
 * children are shown as flat icons so they stay reachable.
 */
function SidebarSection({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const pathname = usePathname();
  const children = item.children ?? [];
  const isChildActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const anyChildActive = children.some((child) => isChildActive(child.href));

  const storageKey = SECTION_OPEN_PREFIX + item.href;
  const [isOpen, setIsOpen] = useState(true);

  // Load persisted open/closed state (defaults to open).
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setIsOpen(stored === "true");
  }, [storageKey]);

  // Always reveal the active section when navigating into one of its children.
  useEffect(() => {
    if (anyChildActive) setIsOpen(true);
  }, [anyChildActive]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  // Icon rail: render the children as flat icons (no expandable header fits).
  if (isCollapsed) {
    return (
      <div className="space-y-1">
        {children.map((child) => (
          <SidebarLink
            key={child.href}
            href={child.href}
            label={child.label}
            iconName={child.iconName ?? item.iconName}
            isCollapsed
            group={item.group}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <SidebarSectionHeader
        label={item.label}
        iconName={item.iconName}
        isOpen={isOpen}
        isActive={anyChildActive}
        group={item.group}
        onClick={toggle}
      />
      {isOpen && (
        <ul
          className={cn(
            "mt-0.5 space-y-0.5",
            item.group ? `ml-5 border-l-2 pl-3 ${GROUP_CHILD_BORDER[item.group]}` : "ml-3"
          )}
        >
          {children.map((child) => (
            <li key={child.href}>
              <SidebarLink
                href={child.href}
                label={child.label}
                iconName={child.iconName ?? item.iconName}
                isCollapsed={false}
                group={item.group}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarChildren({ parentHref, children, group }: { parentHref: string; children: { href: string; label: string }[]; group?: LinkNavGroup }) {
  const pathname = usePathname();
  const isParentActive = pathname.startsWith(parentHref);

  if (!isParentActive) return null;

  return (
    <ul className={cn("mt-0.5 space-y-0.5", group ? `ml-5 border-l-2 pl-3 ${GROUP_CHILD_BORDER[group]}` : "ml-8")}>
      {children.map((child) => {
        const isActive = child.href === parentHref
          ? pathname === parentHref
          : pathname.startsWith(child.href);
        return (
          <li key={child.href}>
            <Link
              href={child.href}
              className={cn(
                "block px-3 py-1.5 text-xs rounded-md transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {child.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
