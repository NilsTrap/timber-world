"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrganizationOption {
  id: string;
  code: string;
  name: string;
}

interface OrganizationSelectorProps {
  organizations: OrganizationOption[];
  currentOrgId: string | null;
  isCollapsed: boolean;
}

/**
 * Organization Selector for Super Admin
 *
 * Dropdown to filter all views by a specific organization.
 * Updates URL with ?org={id} parameter for bookmarking.
 * Hidden when sidebar is collapsed (shows icon only).
 */
export function OrganizationSelector({
  organizations,
  currentOrgId,
  isCollapsed,
}: OrganizationSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (orgId && orgId !== "all") {
      params.set("org", orgId);
    } else {
      params.delete("org");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  // Find current org name for display
  const currentOrg = organizations.find((o) => o.id === currentOrgId);
  const displayName = currentOrg ? currentOrg.code : "All Orgs";

  if (isCollapsed) {
    // Show just an icon when collapsed
    return (
      <div
        className="flex items-center justify-center px-3 py-2 text-muted-foreground"
        title={currentOrg ? `${currentOrg.code} - ${currentOrg.name}` : "All Organizations"}
      >
        <Building2 className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        Organization
      </label>
      <select
        value={currentOrgId || "all"}
        onChange={handleChange}
        className={cn(
          "w-full rounded-md border bg-background px-2 py-1.5 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          "cursor-pointer"
        )}
      >
        <option value="all">All Organizations</option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.code} - {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}
