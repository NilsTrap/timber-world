"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Trash2 } from "lucide-react";

/** Public URL for a catalog image (env-based — do NOT hardcode the project ref). */
export function catalogImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;
}

export interface CatalogImage {
  id: string;
  storagePath: string;
  altText?: string | null;
  isPrimary?: boolean;
}

/** Full-screen image viewer. Close on backdrop click, the ✕, or Escape. */
export function ImageLightbox({ url, alt, onClose }: { url: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/60 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}

/** Hook: `open(url, alt)` shows the lightbox; render `node` where the lightbox should mount. */
export function useLightbox(): { open: (url: string, alt?: string) => void; node: ReactNode } {
  const [src, setSrc] = useState<{ url: string; alt?: string } | null>(null);
  return {
    open: (url, alt) => setSrc({ url, alt }),
    node: src ? <ImageLightbox url={src.url} alt={src.alt} onClose={() => setSrc(null)} /> : null,
  };
}

/**
 * A row of SMALL image thumbnails. Click a thumbnail to enlarge it in a lightbox;
 * hover to reveal a delete button. `onDelete` is the caller's (confirmed) delete.
 */
export function ImageThumbGrid({
  images,
  onDelete,
  openLightbox,
  size = "sm",
}: {
  images: CatalogImage[];
  onDelete: (id: string) => void | Promise<void>;
  openLightbox: (url: string, alt?: string) => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-16 w-16" : "h-20 w-20";
  // Badge only ONE primary, even if the data ever carries more than one (belt-and-
  // suspenders alongside the DB single-primary guard).
  const primaryId = images.find((i) => i.isPrimary)?.id;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img) => {
        const url = catalogImageUrl(img.storagePath);
        return (
          <div key={img.id} className="group relative">
            <button
              type="button"
              onClick={() => openLightbox(url, img.altText || undefined)}
              title="Click to enlarge"
              className={`${dim} block overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary/40`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={img.altText || ""} className="h-full w-full object-cover" />
            </button>
            {img.id === primaryId && (
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-primary px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                Primary
              </span>
            )}
            <button
              type="button"
              onClick={() => onDelete(img.id)}
              title="Delete image"
              className="absolute right-1 top-1 rounded bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
