"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X, FileVideo, FileImage } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@timber/ui";
import { uploadMarketingMedia } from "../actions";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  type MarketingMedia,
} from "../types";

interface MediaUploadDialogProps {
  media: MarketingMedia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * MediaUploadDialog
 *
 * Dialog for uploading/replacing media files with preview.
 */
export function MediaUploadDialog({
  media,
  open,
  onOpenChange,
  onSuccess,
}: MediaUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const isVideo = media?.mimeType.startsWith("video/") || file?.type.startsWith("video/");

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setFile(null);
        setPreview(null);
        setAltText("");
        setDragActive(false);
      } else if (media) {
        setAltText(media.altText || "");
      }
      onOpenChange(newOpen);
    },
    [media, onOpenChange]
  );

  // Handle file selection
  const handleFileChange = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;

    // Validate type
    const isImage = ALLOWED_IMAGE_TYPES.includes(selectedFile.type);
    const isVid = ALLOWED_VIDEO_TYPES.includes(selectedFile.type);
    if (!isImage && !isVid) {
      toast.error("Invalid file type");
      return;
    }

    // Validate size
    const maxSize = isVid ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (selectedFile.size > maxSize) {
      toast.error(`File too large. Max: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  // Drag handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChange(e.dataTransfer.files[0]);
      }
    },
    [handleFileChange]
  );

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!media || !file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (altText) {
        formData.append("altText", altText);
      }

      const result = await uploadMarketingMedia(media.slotKey, formData);

      if (result.success) {
        toast.success("Media uploaded successfully");
        handleOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to upload media");
    } finally {
      setIsUploading(false);
    }
  };

  // Display name for slot
  const displayName = media?.slotKey
    ? media.slotKey.includes("-")
      ? media.slotKey
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ")
      : media.slotKey.charAt(0).toUpperCase() + media.slotKey.slice(1)
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace Media: {displayName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
              ${file ? "bg-muted/50" : "hover:border-primary/50"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {preview ? (
              <div className="relative">
                {isVideo ? (
                  <video
                    src={preview}
                    className="max-h-48 mx-auto rounded"
                    controls
                    muted
                  />
                ) : (
                  <div className="relative h-48 w-full">
                    <Image
                      src={preview}
                      alt="Preview"
                      fill
                      className="object-contain rounded"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-center">
                  {isVideo ? (
                    <FileVideo className="h-12 w-12 text-muted-foreground" />
                  ) : (
                    <FileImage className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Drag & drop or click to select
                </p>
                <p className="text-xs text-muted-foreground">
                  {isVideo
                    ? `MP4, WebM (max ${MAX_VIDEO_SIZE / 1024 / 1024}MB)`
                    : `JPEG, PNG, WebP, SVG (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`}
                </p>
                <label className="cursor-pointer">
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Select File
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept={
                      isVideo
                        ? ALLOWED_VIDEO_TYPES.join(",")
                        : ALLOWED_IMAGE_TYPES.join(",")
                    }
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Alt text */}
          <div className="space-y-2">
            <Label htmlFor="altText">Alt Text (optional)</Label>
            <Input
              id="altText"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the media for accessibility"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!file || isUploading}>
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
