"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrganizationOption {
  id: string;
  code: string;
  name: string;
}

interface OrganizationSelectorProps {
  organizations: OrganizationOption[];
  currentOrgIds: string[];
  isCollapsed: boolean;
}

/**
 * Organization Selector for Super Admin
 *
 * Multi-select popover to filter all views by specific organizations.
 * Updates URL with ?org={id1,id2,...} parameter for bookmarking.
 * Hidden when sidebar is collapsed (shows icon only).
 */
export function OrganizationSelector({
  organizations,
  currentOrgIds,
  isCollapsed,
}: OrganizationSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOrg = (orgId: string) => {
    let newOrgIds: string[];
    if (currentOrgIds.includes(orgId)) {
      newOrgIds = currentOrgIds.filter((id) => id !== orgId);
    } else {
      newOrgIds = [...currentOrgIds, orgId];
    }

    const params = new URLSearchParams(searchParams.toString());

    if (newOrgIds.length > 0) {
      params.set("org", newOrgIds.join(","));
    } else {
      params.delete("org");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const selectAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("org");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  // Get display text
  const selectedOrgs = organizations.filter((o) => currentOrgIds.includes(o.id));
  let displayText: string;
  if (currentOrgIds.length === 0) {
    displayText = "All Orgs";
  } else if (selectedOrgs.length === 1 && selectedOrgs[0]) {
    displayText = selectedOrgs[0].code;
  } else if (selectedOrgs.length <= 3) {
    displayText = selectedOrgs.map((o) => o.code).join(", ");
  } else {
    displayText = `${selectedOrgs.length} selected`;
  }

  if (isCollapsed) {
    // Show just an icon when collapsed
    return (
      <div
        className="flex items-center justify-center px-3 py-2 text-muted-foreground"
        title={currentOrgIds.length === 0 ? "All Organizations" : `${selectedOrgs.length} selected`}
      >
        <Building2 className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="px-3 py-2" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        Organization
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full rounded-md border bg-background px-2 py-1.5 text-sm text-left",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          "cursor-pointer flex items-center justify-between gap-2"
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg">
          <div className="p-2 max-h-64 overflow-y-auto">
            {/* All Organizations option */}
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent",
                currentOrgIds.length === 0 && "bg-accent"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center",
                currentOrgIds.length === 0 ? "bg-primary border-primary text-primary-foreground" : "border-input"
              )}>
                {currentOrgIds.length === 0 && <Check className="h-3 w-3" />}
              </div>
              <span className="font-medium">All Organizations</span>
            </button>

            <div className="h-px bg-border my-2" />

            {/* Individual organizations */}
            {organizations.map((org) => {
              const isSelected = currentOrgIds.includes(org.id);
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => toggleOrg(org.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent text-left",
                    isSelected && "bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  )}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate">{org.code} - {org.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
