"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import type { Process, ProcessWithNotes, ProductionListItem, ProductionHistoryItem } from "../types";
import type { ProcessBreakdownItem, AdminProcessBreakdownItem } from "@/features/dashboard/types";
import { NewProductionForm } from "./NewProductionForm";
import { DraftProductionTable } from "./DraftProductionTable";
import { ProductionHistoryTable } from "./ProductionHistoryTable";
import { ProcessesTab } from "./ProcessesTab";
import { ProcessBreakdownTable } from "@/features/dashboard/components/ProcessBreakdownTable";
import { AdminProcessBreakdownTable } from "@/features/dashboard/components/AdminProcessBreakdownTable";

interface ProductionPageTabsProps {
  processes: Process[];
  processesWithNotes: ProcessWithNotes[];
  drafts: ProductionListItem[];
  history: ProductionHistoryItem[];
  breakdown: ProcessBreakdownItem[] | AdminProcessBreakdownItem[];
  defaultTab?: string;
  defaultProcess?: string;
  showOrganisation?: boolean;
  /** If true, shows delete button for history entries (Super Admin only) */
  canDeleteHistory?: boolean;
  /** Organization name for the Process List tab */
  organizationName?: string;
  /** Organization ID for saving process notes */
  organizationId?: string;
  /** If true, use admin breakdown table with trend indicators */
  isAdmin?: boolean;
}

/**
 * Production Page Tabs
 *
 * Wraps production page content in three tabs:
 * - Drafts: new production form + draft list
 * - Completed: validated production entries with sort/filter
 * - Process List: view and edit process descriptions
 */
export function ProductionPageTabs({
  processes,
  processesWithNotes,
  drafts,
  history,
  breakdown,
  defaultTab,
  defaultProcess,
  showOrganisation = false,
  canDeleteHistory = false,
  organizationName,
  organizationId,
  isAdmin = false,
}: ProductionPageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  // Helper to build URL preserving org filter
  const buildUrl = (params: Record<string, string>) => {
    const orgParam = searchParams.get("org");
    const urlParams = new URLSearchParams(params);
    if (orgParam) {
      urlParams.set("org", orgParam);
    }
    return `/production?${urlParams.toString()}`;
  };

  // Refresh data when returning to /production from a draft page
  useEffect(() => {
    const wasOnDraft = sessionStorage.getItem("production-was-on-draft");

    // If we have the flag and we're on /production, refresh
    if (wasOnDraft && pathname === "/production") {
      sessionStorage.removeItem("production-was-on-draft");
      router.refresh();
    }

    lastPathRef.current = pathname;
  }, [pathname, router]);

  const getDefaultTab = () => {
    if (defaultTab === "history") return "history";
    if (defaultTab === "processes") return "processes";
    if (defaultTab === "consolidated") return "consolidated";
    return "active";
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [activeProcessFilter, setActiveProcessFilter] = useState<string | undefined>(defaultProcess);

  const handleProcessClick = (processName: string) => {
    // Set the filter immediately (before tab switch renders)
    setActiveProcessFilter(processName);
    // Switch to the history tab
    setActiveTab("history");
    // Update the URL with the filter (preserving org)
    router.push(buildUrl({ tab: "history", process: processName }));
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL when tab changes manually (preserving org)
    router.push(buildUrl({ tab: value }));
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="active">Drafts</TabsTrigger>
        <TabsTrigger value="history">Completed</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="processes">Process List</TabsTrigger>
      </TabsList>

      <TabsContent value="active">
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">New Production</h2>
            <NewProductionForm processes={processes} />
          </div>
          <DraftProductionTable entries={drafts} showOrganisation={showOrganisation} />
        </div>
      </TabsContent>

      <TabsContent value="history">
        <ProductionHistoryTable
          key={activeProcessFilter || "all"}
          entries={history}
          defaultProcess={activeProcessFilter}
          showOrganisation={showOrganisation}
          canDelete={canDeleteHistory}
        />
      </TabsContent>

      <TabsContent value="consolidated">
        {isAdmin ? (
          <AdminProcessBreakdownTable
            breakdown={breakdown as AdminProcessBreakdownItem[]}
            onProcessClick={handleProcessClick}
          />
        ) : (
          <ProcessBreakdownTable
            breakdown={breakdown as ProcessBreakdownItem[]}
            onProcessClick={handleProcessClick}
          />
        )}
      </TabsContent>

      <TabsContent value="processes">
        <ProcessesTab
          processes={processesWithNotes}
          organizationName={organizationName}
          organizationId={organizationId}
        />
      </TabsContent>
    </Tabs>
  );
}
