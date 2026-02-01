"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@timber/ui";
import { cn } from "@/lib/utils";

/**
 * Organization option for the switcher
 */
export interface OrganizationSwitcherOption {
  id: string;
  code: string;
  name: string;
  isPrimary?: boolean;
}

interface OrganizationSwitcherProps {
  /** Current organization */
  currentOrganization: OrganizationSwitcherOption | null;
  /** All organizations the user belongs to */
  memberships: OrganizationSwitcherOption[];
  /** Is the sidebar collapsed */
  isCollapsed?: boolean;
  /** Called when organization is switched */
  onSwitch?: (organizationId: string) => void;
}

/**
 * Organization Switcher (Story 10.7)
 *
 * Allows users with multiple organization memberships to switch
 * between their organizations. Shows in sidebar below brand.
 */
export function OrganizationSwitcher({
  currentOrganization,
  memberships,
  isCollapsed = false,
  onSwitch,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show switcher if user has only one membership
  const hasMultiple = memberships.length > 1;

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    // Call server action to update current org
    try {
      const response = await fetch("/api/auth/switch-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (response.ok) {
        onSwitch?.(organizationId);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to switch organization:", error);
    }

    setIsOpen(false);
  };

  // If only one org, show non-interactive display
  if (!hasMultiple) {
    return (
      <div
        className={cn(
          "flex items-center px-3 py-2",
          isCollapsed ? "justify-center" : "gap-2"
        )}
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        {!isCollapsed && (
          <span className="text-sm text-muted-foreground truncate">
            {currentOrganization?.name || "No Organization"}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center px-3 py-2 text-sm transition-colors",
            "hover:bg-accent rounded-md",
            isCollapsed ? "justify-center" : "gap-2"
          )}
        >
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left truncate">
                {currentOrganization?.code || "Select"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {memberships.map((org) => (
          <button
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent"
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{org.code}</span>
              <span className="text-xs text-muted-foreground">{org.name}</span>
            </div>
            {org.id === currentOrganization?.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
