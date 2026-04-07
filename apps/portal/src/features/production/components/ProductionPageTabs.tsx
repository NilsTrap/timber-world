"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import type { Process, ProcessWithNotes, ProductionListItem, ProductionHistoryItem } from "../types";
import type { ProcessBreakdownItem, AdminProcessBreakdownItem } from "@/features/dashboard/types";
import type { TrackingSetListItem } from "../actions/tracking";
import { getValidatedProductions, getProcessesWithNotes } from "../actions";
import { getTrackingSets } from "../actions/tracking";
import { getProcessBreakdown, getAdminProcessBreakdown } from "@/features/dashboard/actions";
import { NewProductionForm } from "./NewProductionForm";
import { DraftProductionTable } from "./DraftProductionTable";
import { ProductionHistoryTable } from "./ProductionHistoryTable";
import { ProcessesTab } from "./ProcessesTab";
import { TrackingTab } from "./TrackingTab";
import { ProcessBreakdownTable } from "@/features/dashboard/components/ProcessBreakdownTable";
import { AdminProcessBreakdownTable } from "@/features/dashboard/components/AdminProcessBreakdownTable";

interface ProductionPageTabsProps {
  processes: Process[];
  drafts: ProductionListItem[];
  defaultTab?: string;
  defaultProcess?: string;
  showOrganisation?: boolean;
  canDeleteHistory?: boolean;
  organizationName?: string;
  organizationId?: string;
  isAdmin?: boolean;
  orgIds?: string[];
}

/**
 * Production Page Tabs
 *
 * Drafts tab data is loaded on the server for instant display.
 * Other tabs (History, Consolidated, Tracking, Processes) load on demand
 * when the user clicks them, providing a faster initial page load.
 */
export function ProductionPageTabs({
  processes,
  drafts,
  defaultTab,
  defaultProcess,
  showOrganisation = false,
  canDeleteHistory = false,
  organizationName,
  organizationId,
  isAdmin = false,
  orgIds,
}: ProductionPageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  // Lazy-loaded tab data
  const [history, setHistory] = useState<ProductionHistoryItem[] | null>(null);
  const [breakdown, setBreakdown] = useState<(ProcessBreakdownItem | AdminProcessBreakdownItem)[] | null>(null);
  const [trackingSets, setTrackingSets] = useState<TrackingSetListItem[] | null>(null);
  const [processesWithNotes, setProcessesWithNotes] = useState<ProcessWithNotes[] | null>(null);
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  // Helper to build URL preserving org filter
  const buildUrl = (params: Record<string, string>) => {
    const orgParam = searchParams.get("org");
    const urlParams = new URLSearchParams(params);
    if (orgParam) {
      urlParams.set("org", orgParam);
    }
    return `/production?${urlParams.toString()}`;
  };

  // Load data for a specific tab
  const loadTabData = useCallback(async (tab: string) => {
    switch (tab) {
      case "history": {
        if (history !== null) return;
        setLoadingTab("history");
        const result = await getValidatedProductions(orgIds);
        setHistory(result.success ? result.data : []);
        setLoadingTab(null);
        break;
      }
      case "consolidated": {
        if (breakdown !== null) return;
        setLoadingTab("consolidated");
        const result = isAdmin
          ? await getAdminProcessBreakdown(undefined, orgIds)
          : await getProcessBreakdown();
        setBreakdown(result.success ? result.data : []);
        setLoadingTab(null);
        break;
      }
      case "tracking": {
        if (trackingSets !== null) return;
        setLoadingTab("tracking");
        const result = await getTrackingSets();
        setTrackingSets(result.success ? result.data : []);
        setLoadingTab(null);
        break;
      }
      case "processes": {
        if (processesWithNotes !== null) return;
        setLoadingTab("processes");
        const noteOrgId = orgIds?.[0] || organizationId;
        const result = await getProcessesWithNotes(noteOrgId);
        setProcessesWithNotes(result.success ? result.data : []);
        setLoadingTab(null);
        break;
      }
    }
  }, [history, breakdown, trackingSets, processesWithNotes, orgIds, isAdmin, organizationId]);

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
    // URL param takes priority
    if (defaultTab === "history") return "history";
    if (defaultTab === "processes") return "processes";
    if (defaultTab === "consolidated") return "consolidated";
    if (defaultTab === "tracking") return "tracking";
    if (defaultTab) return defaultTab;
    // Then check sessionStorage
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("production-tab");
      if (stored) return stored;
    }
    return "active";
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [activeProcessFilter, setActiveProcessFilter] = useState<string | undefined>(defaultProcess);

  // Load data for the initial tab if it's not "active" (drafts)
  useEffect(() => {
    if (activeTab !== "active") {
      loadTabData(activeTab);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProcessClick = (processName: string) => {
    setActiveProcessFilter(processName);
    setActiveTab("history");
    sessionStorage.setItem("production-tab", "history");
    loadTabData("history");
    router.push(buildUrl({ tab: "history", process: processName }));
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    sessionStorage.setItem("production-tab", value);
    loadTabData(value);
    // Update URL when tab changes manually (preserving org)
    router.push(buildUrl({ tab: value }));
  };

  const TabLoading = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="active">Drafts</TabsTrigger>
        <TabsTrigger value="history">Completed</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
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
        {history === null ? (
          <TabLoading />
        ) : (
          <ProductionHistoryTable
            key={activeProcessFilter || "all"}
            entries={history}
            defaultProcess={activeProcessFilter}
            showOrganisation={showOrganisation}
            canDelete={canDeleteHistory}
          />
        )}
      </TabsContent>

      <TabsContent value="consolidated">
        {breakdown === null ? (
          <TabLoading />
        ) : isAdmin ? (
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

      <TabsContent value="tracking">
        {trackingSets === null ? (
          <TabLoading />
        ) : (
          <TrackingTab trackingSets={trackingSets} />
        )}
      </TabsContent>

      <TabsContent value="processes">
        {processesWithNotes === null ? (
          <TabLoading />
        ) : (
          <ProcessesTab
            processes={processesWithNotes}
            organizationName={organizationName}
            organizationId={organizationId}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
