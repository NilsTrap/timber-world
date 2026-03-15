/**
 * Competitor Pricing Types
 */

/**
 * Available options for scraper configuration
 *
 * These are the options available on mass.ee for solid wood panels.
 * Based on discovered products and known URL patterns as of 2026-03-14.
 */
export const SCRAPER_OPTIONS = {
  species: [
    { value: "oak", label: "Oak (Tamm)" },
    { value: "ash", label: "Ash (Saar)" },
    { value: "birch", label: "Birch (Kask)" },
    { value: "pine", label: "Pine (Mänd)" },
    { value: "beech", label: "Beech (Pöök)" },
    { value: "walnut", label: "Walnut (Pähkel)" },
    { value: "maple", label: "Maple (Vaher)" },
    { value: "linden", label: "Linden (Pärn)" },
    { value: "alder", label: "Alder (Lepp)" },
    { value: "cherry", label: "Cherry (Kirsipuu)" },
    { value: "sapele", label: "Sapele (Sapeli)" },
    { value: "pear", label: "Pear (Pirn)" },
    { value: "thermo", label: "Thermo-treated (Termo)" },
  ] as const,
  thicknesses: [14, 16, 18, 19, 20, 24, 26, 27, 28, 30, 38, 40] as const,
  widths: [200, 400, 600, 620, 630, 635, 640, 650, 760, 900, 924, 960, 1200, 1210, 1220, 1225, 1260] as const,
  lengths: [
    800, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500,
    1600, 1700, 1800, 1900, 2000, 2020, 2100, 2200, 2300, 2400, 2440, 2500,
    2600, 2700, 2800, 2900, 3000, 3020, 3100, 3200, 3300, 3500, 3800, 4000, 4200, 4500,
  ] as const,
  panelTypes: [
    { value: "FJ", label: "FJ (Finger Jointed / Sõrmjätkatud)" },
    { value: "FS", label: "FS (Full Stave / Pika Lamelliga)" },
  ] as const,
  qualities: ["A/A", "A/B", "B/B", "B/C", "C/C", "Rustic"] as const,
} as const;

/**
 * Scraper configuration from database
 */
export interface ScraperConfigDb {
  id: string;
  source: string;
  is_enabled: boolean;
  species: string[];
  thicknesses: number[];
  widths: number[];
  lengths: number[];
  panel_types: string[];
  qualities: string[];
  updated_at: string;
}

/**
 * Scraper configuration for UI (camelCase)
 */
export interface ScraperConfig {
  id: string;
  source: string;
  isEnabled: boolean;
  species: string[];
  thicknesses: number[];
  widths: number[];
  lengths: number[];
  panelTypes: string[];
  qualities: string[];
  updatedAt: string;
}

/**
 * Convert database row to UI format
 */
export function toScraperConfig(db: ScraperConfigDb): ScraperConfig {
  return {
    id: db.id,
    source: db.source,
    isEnabled: db.is_enabled,
    species: db.species,
    thicknesses: db.thicknesses,
    widths: db.widths,
    lengths: db.lengths,
    panelTypes: db.panel_types,
    qualities: db.qualities,
    updatedAt: db.updated_at,
  };
}

/**
 * Database row representation
 */
export interface CompetitorPriceDb {
  id: string;
  source: string;
  product_name: string;
  species: string | null;
  panel_type: string | null;
  thickness_mm: number;
  width_mm: number;
  length_mm: number;
  quality: string | null;
  price_per_piece: number | null;
  price_per_m2: number | null;
  price_per_m3: number | null;
  ti_price_per_piece: number | null;
  ti_price_per_m2: number | null;
  ti_price_per_m3: number | null;
  price_diff_percent: number | null;
  stock_total: number;
  stock_locations: Record<string, number>;
  product_url: string | null;
  scraped_at: string;
  created_at: string;
}

/**
 * Server action result type
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Filter options for the pricing table
 */
export interface PricingFilters {
  source: string | null;
  thickness: number | null;
}

/**
 * Summary statistics for the pricing data
 */
export interface PricingSummary {
  totalProducts: number;
  totalStock: number;
  averagePrice: number;
  lastScrapedAt: string | null;
}

/**
 * Format price as EUR with 2 decimal places
 */
export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format stock locations as a readable string
 */
export function formatStockLocations(
  locations: Record<string, number> | null | undefined
): string {
  if (!locations) return "-";
  const parts: string[] = [];
  const tallinn = locations.tallinn ?? 0;
  const tartu = locations.tartu ?? 0;
  if (tallinn > 0) {
    parts.push(`TLN: ${tallinn}`);
  }
  if (tartu > 0) {
    parts.push(`TRT: ${tartu}`);
  }
  return parts.length > 0 ? parts.join(", ") : "-";
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Calculate summary statistics from pricing data
 */
export function calculateSummary(data: CompetitorPriceDb[]): PricingSummary {
  if (data.length === 0) {
    return {
      totalProducts: 0,
      totalStock: 0,
      averagePrice: 0,
      lastScrapedAt: null,
    };
  }

  const totalStock = data.reduce((sum, item) => sum + (item.stock_total || 0), 0);
  const pricesWithValues = data.filter((item) => item.price_per_piece !== null);
  const averagePrice =
    pricesWithValues.length > 0
      ? pricesWithValues.reduce((sum, item) => sum + (item.price_per_piece || 0), 0) /
        pricesWithValues.length
      : 0;

  // Find most recent scrape time
  const sortedByScrapedAt = [...data].sort(
    (a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
  );

  return {
    totalProducts: data.length,
    totalStock,
    averagePrice,
    lastScrapedAt: sortedByScrapedAt[0]?.scraped_at || null,
  };
}
