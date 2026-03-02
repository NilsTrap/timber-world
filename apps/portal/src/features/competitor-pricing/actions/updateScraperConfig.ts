"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ScraperConfigDb, ScraperConfig, ActionResult } from "../types";
import { toScraperConfig } from "../types";

/**
 * Update input for scraper configuration
 */
export interface UpdateScraperConfigInput {
  source: string;
  isEnabled?: boolean;
  species?: string[];
  thicknesses?: number[];
  widths?: number[];
  lengths?: number[];
  panelTypes?: string[];
  qualities?: string[];
}

/**
 * Update scraper configuration for a specific source
 */
export async function updateScraperConfig(
  input: UpdateScraperConfigInput
): Promise<ActionResult<ScraperConfig>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // Build update object (only include provided fields)
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.isEnabled !== undefined) {
    updateData.is_enabled = input.isEnabled;
  }
  if (input.species !== undefined) {
    updateData.species = input.species;
  }
  if (input.thicknesses !== undefined) {
    updateData.thicknesses = input.thicknesses;
  }
  if (input.widths !== undefined) {
    updateData.widths = input.widths;
  }
  if (input.lengths !== undefined) {
    updateData.lengths = input.lengths;
  }
  if (input.panelTypes !== undefined) {
    updateData.panel_types = input.panelTypes;
  }
  if (input.qualities !== undefined) {
    updateData.qualities = input.qualities;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("scraper_config")
    .update(updateData)
    .eq("source", input.source)
    .select()
    .single();

  if (error) {
    console.error("Failed to update scraper config:", error);
    return {
      success: false,
      error: "Failed to update scraper configuration",
      code: "UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: toScraperConfig(data as ScraperConfigDb),
  };
}
