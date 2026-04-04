import { createClient } from "@/lib/supabase/server";

/**
 * Get enabled features for an organization
 *
 * Lightweight function to fetch which features are enabled for a specific organization.
 * Used primarily for filtering navigation items in the sidebar.
 *
 * @param organizationId - Organization ID to check features for
 * @returns Set of enabled feature codes
 */
export async function getOrgEnabledFeatures(
  organizationId: string | null
): Promise<Set<string>> {
  if (!organizationId) {
    return new Set();
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Get explicitly enabled features
  const { data: orgFeatures } = await client
    .from("organization_features")
    .select("feature_code, enabled")
    .eq("organization_id", organizationId);

  const enabledFeatures = new Set<string>();

  // Track explicitly enabled features
  (orgFeatures || []).forEach((f: { feature_code: string; enabled: boolean }) => {
    if (f.enabled) {
      enabledFeatures.add(f.feature_code);
    }
  });

  return enabledFeatures;
}

/**
 * Check if an organization has a specific feature enabled
 */
export async function orgHasFeature(
  organizationId: string | null,
  featureCode: string
): Promise<boolean> {
  const features = await getOrgEnabledFeatures(organizationId);
  return features.has(featureCode);
}
