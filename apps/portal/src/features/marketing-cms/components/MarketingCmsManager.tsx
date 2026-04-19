"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { ContentTab } from "./ContentTab";
import { MetaTab } from "./MetaTab";
import { ReferenceDataManager } from "@/features/reference-data";
import { AnalyticsDashboard } from "@/features/analytics";
import { MarketingStockManager } from "@/features/marketing-stock";

interface MarketingCmsManagerProps {
  /** If true, shows delete button for reference options (Super Admin only) */
  canDelete?: boolean;
}

const VALID_TABS = ["content", "meta", "reference", "analytics", "stock"] as const;
type TabValue = (typeof VALID_TABS)[number];

/**
 * MarketingCmsManager
 *
 * Main component for the Marketing CMS page.
 * Four tabs: Content (media + texts), Meta, Reference Data, and Analytics.
 * Tab state is synced with URL query param for deep linking.
 */
export function MarketingCmsManager({ canDelete = false }: MarketingCmsManagerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get tab from URL or default to "content"
  const tabParam = searchParams.get("tab");
  const currentTab: TabValue = VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "content";

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "content") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="meta">Meta</TabsTrigger>
        <TabsTrigger value="reference">Reference Data</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
      </TabsList>

      <TabsContent value="content" className="mt-4">
        <ContentTab />
      </TabsContent>

      <TabsContent value="meta" className="mt-4">
        <MetaTab />
      </TabsContent>

      <TabsContent value="reference" className="mt-4">
        <ReferenceDataManager canDelete={canDelete} />
      </TabsContent>

      <TabsContent value="analytics" className="mt-4">
        <AnalyticsDashboard />
      </TabsContent>

      <TabsContent value="stock" className="mt-4">
        <MarketingStockManager />
      </TabsContent>
    </Tabs>
  );
}
