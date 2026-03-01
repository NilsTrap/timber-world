"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon, Video, RefreshCw } from "lucide-react";
import { Button, Card } from "@timber/ui";
import type { MarketingMedia } from "../types";

interface MediaCardProps {
  media: MarketingMedia;
  onReplace: (media: MarketingMedia) => void;
}

/**
 * MediaCard
 *
 * Displays a preview of a media item with replace button.
 */
export function MediaCard({ media, onReplace }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);
  const isVideo = media.mimeType.startsWith("video/");
  const hasFile = media.publicUrl && !imageError;

  // Format slot key for display (e.g., "forest-maturing" -> "Maturing")
  const displayName = media.slotKey.includes("-")
    ? media.slotKey.split("-").pop()!.charAt(0).toUpperCase() +
      media.slotKey.split("-").pop()!.slice(1)
    : media.slotKey.charAt(0).toUpperCase() + media.slotKey.slice(1);

  return (
    <Card className="overflow-hidden group relative">
      {/* Preview area */}
      <div className="aspect-[4/3] bg-muted relative flex items-center justify-center">
        {hasFile ? (
          isVideo ? (
            <video
              src={media.publicUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <Image
              src={media.publicUrl!}
              alt={media.altText || displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
              onError={() => setImageError(true)}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {isVideo ? (
              <Video className="h-8 w-8" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <span className="text-xs">No file uploaded</span>
          </div>
        )}

        {/* Hover overlay with replace button */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReplace(media)}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Replace
          </Button>
        </div>

        {/* Inactive badge */}
        {!media.isActive && (
          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded">
            Inactive
          </div>
        )}
      </div>

      {/* Footer with label */}
      <div className="p-2 border-t">
        <p className="text-sm font-medium truncate" title={media.slotKey}>
          {displayName}
        </p>
        {media.altText && (
          <p className="text-xs text-muted-foreground truncate" title={media.altText}>
            {media.altText}
          </p>
        )}
      </div>
    </Card>
  );
}
