"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { PhotosVideosTab } from "./PhotosVideosTab";
import { TextsTab } from "./TextsTab";
import { MetaTab } from "./MetaTab";
import { ReferenceDataManager } from "@/features/reference-data";
import { AnalyticsDashboard } from "@/features/analytics";

interface MarketingCmsManagerProps {
  /** If true, shows delete button for reference options (Super Admin only) */
  canDelete?: boolean;
}

const VALID_TABS = ["media", "texts", "meta", "reference", "analytics"] as const;
type TabValue = (typeof VALID_TABS)[number];

/**
 * MarketingCmsManager
 *
 * Main component for the Marketing CMS page.
 * Five tabs: Photos/Videos, Texts, Meta, Reference Data, and Analytics.
 * Tab state is synced with URL query param for deep linking.
 */
export function MarketingCmsManager({ canDelete = false }: MarketingCmsManagerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get tab from URL or default to "media"
  const tabParam = searchParams.get("tab");
  const currentTab: TabValue = VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "media";

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "media") {
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
        <TabsTrigger value="media">Photos/Videos</TabsTrigger>
        <TabsTrigger value="texts">Texts</TabsTrigger>
        <TabsTrigger value="meta">Meta</TabsTrigger>
        <TabsTrigger value="reference">Reference Data</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="media" className="mt-4">
        <PhotosVideosTab />
      </TabsContent>

      <TabsContent value="texts" className="mt-4">
        <TextsTab />
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
    </Tabs>
  );
}
