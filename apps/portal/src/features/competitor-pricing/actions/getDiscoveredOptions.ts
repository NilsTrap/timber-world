"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Available options derived from mass.ee's filter UI and discovered product URLs
 */
export interface DiscoveredOptions {
  species: string[];
  panelTypes: string[];
  qualities: string[];
  thicknesses: number[];
  widths: number[];
  lengths: number[];
}

/**
 * Get the actual available options — all derived from discovered product URLs.
 */
export async function getDiscoveredOptions(
  source: string
): Promise<ActionResult<DiscoveredOptions>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // All options come from discovered product URLs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: urlData } = await (supabase as any)
    .from("scraper_product_urls")
    .select("species, panel_type, quality, thickness_mm, width_mm, length_mm")
    .eq("source", source)
    .eq("is_active", true);

  const speciesSet = new Set<string>();
  const panelTypeSet = new Set<string>();
  const qualitySet = new Set<string>();
  const thicknessSet = new Set<number>();
  const widthSet = new Set<number>();
  const lengthSet = new Set<number>();

  for (const row of urlData || []) {
    if (row.species) speciesSet.add(row.species);
    if (row.panel_type) panelTypeSet.add(row.panel_type);
    if (row.quality) qualitySet.add(row.quality);
    if (row.thickness_mm) thicknessSet.add(row.thickness_mm);
    if (row.width_mm) widthSet.add(row.width_mm);
    if (row.length_mm) lengthSet.add(row.length_mm);
  }

  return {
    success: true,
    data: {
      species: [...speciesSet].sort(),
      panelTypes: [...panelTypeSet].sort(),
      qualities: [...qualitySet].sort(),
      thicknesses: [...thicknessSet].sort((a, b) => a - b),
      widths: [...widthSet].sort((a, b) => a - b),
      lengths: [...lengthSet].sort((a, b) => a - b),
    },
  };
}
