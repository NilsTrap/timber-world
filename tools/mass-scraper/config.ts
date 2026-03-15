/**
 * Scraper Configuration Module
 *
 * Fetches configuration from Supabase scraper_config table
 *
 * Usage:
 *   import { loadConfig, type ScraperConfig } from './config';
 *   const config = await loadConfig('mass.ee');
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

export interface ScraperConfig {
  source: string;
  isEnabled: boolean;
  species: string[];
  thicknesses: number[];
  widths: number[];
  lengths: number[];
  panelTypes: string[];
  qualities: string[];
}

interface ScraperConfigDb {
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
 * Load scraper configuration from Supabase
 */
export async function loadConfig(source: string): Promise<ScraperConfig | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing environment variables");
    console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("scraper_config")
    .select("*")
    .eq("source", source)
    .single();

  if (error) {
    console.error(`Error loading config for ${source}:`, error.message);
    return null;
  }

  const dbConfig = data as ScraperConfigDb;

  return {
    source: dbConfig.source,
    isEnabled: dbConfig.is_enabled,
    species: dbConfig.species,
    thicknesses: dbConfig.thicknesses,
    widths: dbConfig.widths,
    lengths: dbConfig.lengths,
    panelTypes: dbConfig.panel_types,
    qualities: dbConfig.qualities,
  };
}

/**
 * Species name mapping (English -> Estonian slug for mass.ee URLs)
 */
const SPECIES_SLUGS: Record<string, string> = {
  oak: "tamm",
  ash: "eur--saar",
  birch: "kask",
  pine: "mand",
  beech: "pook",
  walnut: "pahkel",
  maple: "vaher",
  linden: "parn",
  alder: "lepp",
  cherry: "kirsi",
  sapele: "sapeli",
  pear: "pirn",
  thermo: "termo",
};

/**
 * Panel type mapping (value -> URL slug)
 */
const PANEL_TYPE_SLUGS: Record<string, string> = {
  FS: "pikk-lamell", // Full Stave / Pika lamelliga
  FJ: "sormjatk",    // Finger Jointed / Sõrmjätkatud
};

/**
 * Quality grade -> URL slug mapping
 */
const QUALITY_SLUGS: Record<string, string> = {
  "A/A": "a-a",
  "A/B": "a-b",
  "B/B": "b-b",
  "B/C": "b-c",
  "C/C": "c-c",
  "Rustic": "rustic",
};

/**
 * Generate product URLs based on configuration
 *
 * mass.ee URL patterns:
 * Full Stave: https://mass.ee/liimpuit-{species}-pikk-lamell-{thickness}-x-{width}-x-{length}mm-{quality}
 * Finger Jointed: https://mass.ee/liimpuit-{species}-sormjatk-{thickness}-x-{width}-x-{length}mm-{quality}
 */
export function generateUrls(config: ScraperConfig): string[] {
  const urls: string[] = [];

  // Get species to scrape (default to oak if none specified)
  const speciesList = config.species.length > 0 ? config.species : ["oak"];

  // Get panel types to scrape (default to FS if none specified)
  const panelTypes = config.panelTypes.length > 0 ? config.panelTypes : ["FS"];

  for (const species of speciesList) {
    const speciesSlug = SPECIES_SLUGS[species] || species;

    for (const panelType of panelTypes) {
      const typeSlug = PANEL_TYPE_SLUGS[panelType] || "pikk-lamell";

      for (const thickness of config.thicknesses) {
        for (const width of config.widths) {
          for (const length of config.lengths) {
            for (const quality of config.qualities) {
              const qualitySlug = QUALITY_SLUGS[quality] || quality.toLowerCase().replace("/", "-");
              const url = `https://mass.ee/liimpuit-${speciesSlug}-${typeSlug}-${thickness}-x-${width}-x-${length}mm-${qualitySlug}`;
              urls.push(url);
            }
          }
        }
      }
    }
  }

  return urls;
}

/**
 * Load saved product URLs from scraper_product_urls table
 * These are URLs that were previously discovered to have actual products
 */
export async function loadSavedUrls(source: string): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing environment variables for loading saved URLs");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("scraper_product_urls")
    .select("url")
    .eq("source", source)
    .eq("is_active", true);

  if (error) {
    console.error(`Error loading saved URLs for ${source}:`, error.message);
    return [];
  }

  return (data || []).map((row) => row.url);
}

/**
 * Check if a product matches the configuration filters
 */
export function matchesConfig(
  config: ScraperConfig,
  product: { thickness: number; width: number; length: number; quality?: string }
): boolean {
  // Check thickness
  if (config.thicknesses.length > 0 && !config.thicknesses.includes(product.thickness)) {
    return false;
  }

  // Check width
  if (config.widths.length > 0 && !config.widths.includes(product.width)) {
    return false;
  }

  // Check length
  if (config.lengths.length > 0 && !config.lengths.includes(product.length)) {
    return false;
  }

  // Check quality (if specified)
  if (config.qualities.length > 0 && product.quality) {
    const normalizedQuality = product.quality.toUpperCase().replace("-", "/");
    const normalizedQualities = config.qualities.map(q => q.toUpperCase());
    if (!normalizedQualities.includes(normalizedQuality) && !normalizedQualities.includes(product.quality)) {
      return false;
    }
  }

  return true;
}
