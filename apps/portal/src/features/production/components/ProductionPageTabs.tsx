"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import type { Process, ProcessWithNotes, ProductionListItem, ProductionHistoryItem } from "../types";
import type { ProcessBreakdownItem, AdminProcessBreakdownItem } from "@/features/dashboard/types";
import { NewProductionForm } from "./NewProductionForm";
import { DraftProductionList } from "./DraftProductionList";
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
  const getDefaultTab = () => {
    if (defaultTab === "history") return "history";
    if (defaultTab === "processes") return "processes";
    if (defaultTab === "consolidated") return "consolidated";
    return "active";
  };

  return (
    <Tabs defaultValue={getDefaultTab()}>
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
          <DraftProductionList drafts={drafts} />
        </div>
      </TabsContent>

      <TabsContent value="history">
        <ProductionHistoryTable entries={history} defaultProcess={defaultProcess} showOrganisation={showOrganisation} canDelete={canDeleteHistory} />
      </TabsContent>

      <TabsContent value="consolidated">
        {isAdmin ? (
          <AdminProcessBreakdownTable
            breakdown={breakdown as AdminProcessBreakdownItem[]}
            onProcessClick={() => {}}
          />
        ) : (
          <ProcessBreakdownTable breakdown={breakdown as ProcessBreakdownItem[]} />
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
