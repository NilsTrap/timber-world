"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Organization Feature Configuration
 */
export interface OrganisationFeature {
  featureCode: string;
  featureName: string;
  featureDescription: string | null;
  category: string;
  enabled: boolean;
}

/**
 * Get organization's feature configuration
 */
export async function getOrganisationFeatures(
  organisationId: string
): Promise<ActionResult<OrganisationFeature[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get all features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: featuresData, error: featuresError } = await (supabase as any)
    .from("features")
    .select("code, name, description, category, sort_order")
    .order("category")
    .order("sort_order");

  if (featuresError) {
    console.error("Failed to fetch features:", featuresError);
    return { success: false, error: "Failed to fetch features", code: "QUERY_FAILED" };
  }

  // Get organization's enabled features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgFeaturesData, error: orgFeaturesError } = await (supabase as any)
    .from("organization_features")
    .select("feature_code, enabled")
    .eq("organization_id", organisationId);

  if (orgFeaturesError) {
    console.error("Failed to fetch org features:", orgFeaturesError);
    return { success: false, error: "Failed to fetch organization features", code: "QUERY_FAILED" };
  }

  // Create map of enabled features
  const enabledMap = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (orgFeaturesData || []).forEach((of: any) => {
    enabledMap.set(of.feature_code, of.enabled);
  });

  // Merge features with enabled status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: OrganisationFeature[] = (featuresData || []).map((f: any) => ({
    featureCode: f.code,
    featureName: f.name,
    featureDescription: f.description,
    category: f.category || "Other",
    enabled: enabledMap.get(f.code) ?? false,
  }));

  return { success: true, data: features };
}

/**
 * Update organization's feature configuration
 */
export async function updateOrganisationFeatures(
  organisationId: string,
  featureCodes: string[]
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Delete existing feature configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("organization_features")
    .delete()
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete org features:", deleteError);
    return { success: false, error: "Failed to update features", code: "DELETE_FAILED" };
  }

  // Insert new feature configuration
  if (featureCodes.length > 0) {
    const features = featureCodes.map((code) => ({
      organization_id: organisationId,
      feature_code: code,
      enabled: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("organization_features")
      .insert(features);

    if (insertError) {
      console.error("Failed to insert org features:", insertError);
      return { success: false, error: "Failed to update features", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}
