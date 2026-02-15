"use client";

import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { ProducerInventory } from "./ProducerInventory";
import { ConsolidatedInventoryTable } from "@/features/dashboard/components/ConsolidatedInventoryTable";
import type { PackageListItem } from "../types";
import type { DraftPackageInfo } from "@/features/production/actions";
import type { ShipmentDraftPackageInfo } from "@/features/shipments/actions";
import type { ConsolidatedInventoryItem } from "@/features/dashboard/types";

interface ProducerInventoryPageContentProps {
  packages: PackageListItem[];
  packagesInDrafts: DraftPackageInfo[];
  packagesInShipmentDrafts: ShipmentDraftPackageInfo[];
  consolidated: ConsolidatedInventoryItem[];
  initialFilters?: Record<string, string[]>;
}

/**
 * Producer Inventory Page Content
 *
 * Two tabs:
 * - Inventory: Full package list with filters
 * - Consolidated: Grouped view by product attributes
 */
export function ProducerInventoryPageContent({
  packages,
  packagesInDrafts,
  packagesInShipmentDrafts,
  consolidated,
  initialFilters,
}: ProducerInventoryPageContentProps) {
  return (
    <Tabs defaultValue="inventory">
      <TabsList>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ProducerInventory
            packages={packages}
            packagesInDrafts={packagesInDrafts}
            packagesInShipmentDrafts={packagesInShipmentDrafts}
            initialFilters={initialFilters}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="consolidated">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ConsolidatedInventoryTable data={consolidated} inventoryUrl="/inventory" />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
