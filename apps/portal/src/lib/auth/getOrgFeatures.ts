"use server";

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
  const explicitlySet = new Map<string, boolean>();

  // Track explicitly set features
  (orgFeatures || []).forEach((f: { feature_code: string; enabled: boolean }) => {
    explicitlySet.set(f.feature_code, f.enabled);
    if (f.enabled) {
      enabledFeatures.add(f.feature_code);
    }
  });

  // Get org type default features for features not explicitly set
  const { data: orgTypes } = await client
    .from("organization_type_assignments")
    .select("organization_types(default_features)")
    .eq("organization_id", organizationId);

  // Get all available features for wildcard expansion
  const { data: allFeatures } = await client.from("features").select("code");
  const allFeatureCodes = allFeatures?.map((f: { code: string }) => f.code) || [];

  // Add default features from org types (if not explicitly disabled)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orgTypes?.forEach((ot: any) => {
    const defaultFeatures = ot.organization_types?.default_features || [];
    defaultFeatures.forEach((f: string) => {
      if (f === "*") {
        // Wildcard - add all features not explicitly disabled
        allFeatureCodes.forEach((fc: string) => {
          if (!explicitlySet.has(fc) || explicitlySet.get(fc) === true) {
            enabledFeatures.add(fc);
          }
        });
      } else if (f.endsWith("*")) {
        // Prefix wildcard (e.g., "production.*")
        const prefix = f.replace("*", "");
        allFeatureCodes
          .filter((fc: string) => fc.startsWith(prefix))
          .forEach((fc: string) => {
            if (!explicitlySet.has(fc) || explicitlySet.get(fc) === true) {
              enabledFeatures.add(fc);
            }
          });
      } else {
        // Specific feature
        if (!explicitlySet.has(f) || explicitlySet.get(f) === true) {
          enabledFeatures.add(f);
        }
      }
    });
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
