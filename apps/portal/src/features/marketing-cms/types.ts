/**
 * Marketing CMS Types
 *
 * Types for managing marketing media (images, videos, logos).
 */

/**
 * Media category types
 */
export type MediaCategory = "journey" | "hero" | "logo" | "product";

/**
 * Product image slots (10 products)
 */
export const PRODUCT_SLOTS = [
  { key: "product-1", label: "Product 1" },
  { key: "product-2", label: "Product 2" },
  { key: "product-3", label: "Product 3" },
  { key: "product-4", label: "Product 4" },
  { key: "product-5", label: "Product 5" },
  { key: "product-6", label: "Product 6" },
  { key: "product-7", label: "Product 7" },
  { key: "product-8", label: "Product 8" },
  { key: "product-9", label: "Product 9" },
  { key: "product-10", label: "Product 10" },
] as const;

/**
 * Marketing media record from database
 */
export interface MarketingMedia {
  id: string;
  category: MediaCategory;
  slotKey: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Signed URL for display (not persisted) */
  publicUrl?: string;
}

/**
 * Journey stage groupings for display
 */
export const JOURNEY_STAGES = [
  {
    key: "forest",
    label: "Forest",
    substages: ["maturing", "harvesting", "renewing"],
  },
  {
    key: "sawmill",
    label: "Sawmill",
    substages: ["grading", "sawing", "stacking"],
  },
  {
    key: "kiln",
    label: "Kiln",
    substages: ["arranging", "drying", "protecting"],
  },
  {
    key: "factory",
    label: "Factory",
    substages: ["multisaw", "opticut", "planing", "fingerjointing", "gluing", "calibrating"],
  },
  {
    key: "workshop",
    label: "Workshop",
    substages: ["cnc", "bonding", "sanding", "finishing", "packaging"],
  },
  {
    key: "warehouse",
    label: "Warehouse",
    substages: ["controlling", "storing", "delivering", "feedback"],
  },
] as const;

/**
 * Allowed MIME types for uploads
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
];

/**
 * Max file sizes (in bytes)
 */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Server action result type
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Marketing text record from database
 */
export interface MarketingText {
  id: string;
  category: string;
  section: string;
  key: string;
  locale: string;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Grouped texts for a journey section
 */
export interface JourneySectionTexts {
  section: string;
  title: string;
  description: string;
  substages: {
    key: string;
    title: string;
    description: string;
  }[];
}

/**
 * Hero section texts
 */
export interface HeroTexts {
  slogan: string;
  subtitle: string;
}

/**
 * Product texts
 */
export interface ProductTexts {
  key: string;
  title: string;
  description: string;
}
