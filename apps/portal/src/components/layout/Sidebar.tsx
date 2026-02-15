"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@timber/ui";
import { cn } from "@/lib/utils";
import { SidebarLink, type IconName } from "./SidebarLink";
import { OrganizationSelector, type OrganizationOption } from "./OrganizationSelector";
import {
  OrganizationSwitcher,
  type OrganizationSwitcherOption,
} from "./OrganizationSwitcher";
import { logoutUser } from "@/features/auth/actions";

/**
 * Navigation Item Type
 */
export interface NavItem {
  href: string;
  label: string;
  iconName: IconName;
  /** Optional badge count to display */
  badge?: number;
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
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
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
          {navItems.map((item) => (
            <li key={item.href}>
              <SidebarLink
                href={item.href}
                label={item.label}
                iconName={item.iconName}
                isCollapsed={isCollapsed}
                badge={item.badge}
              />
            </li>
          ))}
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
