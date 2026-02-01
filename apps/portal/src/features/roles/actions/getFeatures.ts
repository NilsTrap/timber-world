"use server";

import { createClient } from "@/lib/supabase/server";

export interface Feature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
}

export interface FeaturesByCategory {
  [category: string]: Feature[];
}

export async function getFeatures(): Promise<{
  success: boolean;
  data?: Feature[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: features, error } = await (supabase as any)
      .from("features")
      .select("*")
      .order("sort_order");

    if (error) {
      return { success: false, error: error.message };
    }

    const formattedFeatures: Feature[] = features.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        description: f.description,
        category: f.category,
        sortOrder: f.sort_order,
      })
    );

    return { success: true, data: formattedFeatures };
  } catch (error) {
    console.error("Error fetching features:", error);
    return { success: false, error: "Failed to fetch features" };
  }
}

export async function getFeaturesByCategory(): Promise<{
  success: boolean;
  data?: FeaturesByCategory;
  error?: string;
}> {
  const result = await getFeatures();

  if (!result.success || !result.data) {
    return result as { success: false; error: string };
  }

  const byCategory: FeaturesByCategory = {};
  result.data.forEach((feature) => {
    const category = feature.category || "Other";
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(feature);
  });

  return { success: true, data: byCategory };
}
