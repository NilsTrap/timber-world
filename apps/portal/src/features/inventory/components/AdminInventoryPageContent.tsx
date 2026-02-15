"use client";

import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { AdminInventoryViewTab } from "./AdminInventoryViewTab";
import { EditablePackagesTab } from "./EditablePackagesTab";
import { ConsolidatedInventoryTable } from "@/features/dashboard/components/ConsolidatedInventoryTable";
import type { EditablePackageItem } from "@/features/shipments/types";
import type { ConsolidatedInventoryItem } from "@/features/dashboard/types";

interface AdminInventoryPageContentProps {
  packages: EditablePackageItem[];
  consolidated: ConsolidatedInventoryItem[];
  /** Initial filter values from URL params */
  initialFilters?: Record<string, string[]>;
}

/**
 * Admin Inventory Page Content
 *
 * Three tabs:
 * - Inventory: Read-only view of all packages (same as producer view but with org column)
 * - Consolidated: Grouped view by product attributes
 * - Edit: Full editing capabilities (add, edit, delete, import)
 */
export function AdminInventoryPageContent({ packages, consolidated, initialFilters }: AdminInventoryPageContentProps) {
  return (
    <Tabs defaultValue="inventory">
      <TabsList>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="edit">Edit</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <AdminInventoryViewTab packages={packages} initialFilters={initialFilters} />
        </Suspense>
      </TabsContent>

      <TabsContent value="consolidated">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ConsolidatedInventoryTable data={consolidated} inventoryUrl="/admin/inventory" />
        </Suspense>
      </TabsContent>

      <TabsContent value="edit">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <EditablePackagesTab packages={packages} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
