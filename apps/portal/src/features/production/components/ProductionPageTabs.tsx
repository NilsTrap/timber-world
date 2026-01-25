"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import type { Process, ProductionListItem, ProductionHistoryItem } from "../types";
import { NewProductionForm } from "./NewProductionForm";
import { DraftProductionList } from "./DraftProductionList";
import { ProductionHistoryTable } from "./ProductionHistoryTable";

interface ProductionPageTabsProps {
  processes: Process[];
  drafts: ProductionListItem[];
  history: ProductionHistoryItem[];
  defaultTab?: string;
  defaultProcess?: string;
  showOrganisation?: boolean;
}

/**
 * Production Page Tabs
 *
 * Wraps production page content in "Active" and "History" tabs.
 * Active tab: new production form + draft list.
 * History tab: validated production entries with sort/filter.
 */
export function ProductionPageTabs({
  processes,
  drafts,
  history,
  defaultTab,
  defaultProcess,
  showOrganisation = false,
}: ProductionPageTabsProps) {
  return (
    <Tabs defaultValue={defaultTab === "history" ? "history" : "active"}>
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
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
        <ProductionHistoryTable entries={history} defaultProcess={defaultProcess} showOrganisation={showOrganisation} />
      </TabsContent>
    </Tabs>
  );
}
