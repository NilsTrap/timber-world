"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import type { Process, ProcessWithNotes, ProductionListItem, ProductionHistoryItem } from "../types";
import { NewProductionForm } from "./NewProductionForm";
import { DraftProductionList } from "./DraftProductionList";
import { ProductionHistoryTable } from "./ProductionHistoryTable";
import { ProcessesTab } from "./ProcessesTab";

interface ProductionPageTabsProps {
  processes: Process[];
  processesWithNotes: ProcessWithNotes[];
  drafts: ProductionListItem[];
  history: ProductionHistoryItem[];
  defaultTab?: string;
  defaultProcess?: string;
  showOrganisation?: boolean;
  /** If true, shows delete button for history entries (Super Admin only) */
  canDeleteHistory?: boolean;
  /** Organization name for the Process List tab */
  organizationName?: string;
  /** Organization ID for saving process notes */
  organizationId?: string;
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
  defaultTab,
  defaultProcess,
  showOrganisation = false,
  canDeleteHistory = false,
  organizationName,
  organizationId,
}: ProductionPageTabsProps) {
  return (
    <Tabs defaultValue={defaultTab === "history" ? "history" : defaultTab === "processes" ? "processes" : "active"}>
      <TabsList>
        <TabsTrigger value="active">Drafts</TabsTrigger>
        <TabsTrigger value="history">Completed</TabsTrigger>
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
