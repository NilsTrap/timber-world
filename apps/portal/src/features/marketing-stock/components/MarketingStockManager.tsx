"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { MarketingStockTable } from "./MarketingStockTable";
import { MarketingSourcesTable } from "./MarketingSourcesTable";

export function MarketingStockManager() {
  return (
    <Tabs defaultValue="stock">
      <TabsList>
        <TabsTrigger value="stock">Stock</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
      </TabsList>

      <TabsContent value="stock" className="space-y-6">
        <MarketingStockTable />
      </TabsContent>

      <TabsContent value="sources" className="space-y-6">
        <MarketingSourcesTable />
      </TabsContent>
    </Tabs>
  );
}
