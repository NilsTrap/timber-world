"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMarketingMedia } from "../actions";
import { HeroMediaSection } from "./HeroMediaSection";
import { JourneyMediaGrid } from "./JourneyMediaGrid";
import { LogosSection } from "./LogosSection";
import { ProductsSection } from "./ProductsSection";
import { MediaUploadDialog } from "./MediaUploadDialog";
import type { MarketingMedia } from "../types";

/**
 * PhotosVideosTab
 *
 * Main content for the Photos/Videos tab. Shows Hero, Journey, and Logos sections.
 */
export function PhotosVideosTab() {
  const [media, setMedia] = useState<MarketingMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MarketingMedia | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Fetch all media
  const fetchMedia = useCallback(async () => {
    setIsLoading(true);
    const result = await getMarketingMedia();
    if (result.success) {
      setMedia(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Handle replace click
  const handleReplace = useCallback((m: MarketingMedia) => {
    setSelectedMedia(m);
    setUploadDialogOpen(true);
  }, []);

  // Handle upload success
  const handleUploadSuccess = useCallback(() => {
    fetchMedia();
  }, [fetchMedia]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Split media by category
  const heroMedia = media.filter((m) => m.category === "hero");
  const journeyMedia = media.filter((m) => m.category === "journey");
  const logoMedia = media.filter((m) => m.category === "logo");
  const productMedia = media.filter((m) => m.category === "product");

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <HeroMediaSection media={heroMedia} onReplace={handleReplace} />

      {/* Products */}
      <ProductsSection media={productMedia} onReplace={handleReplace} />

      {/* Journey Stages */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Production Journey</h3>
        <JourneyMediaGrid media={journeyMedia} onReplace={handleReplace} />
      </div>

      {/* Logos */}
      <LogosSection media={logoMedia} onReplace={handleReplace} />

      {/* Upload Dialog */}
      <MediaUploadDialog
        media={selectedMedia}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
