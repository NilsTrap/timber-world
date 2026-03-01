"use server";

import { createClient } from "@timber/database/server";

/**
 * Product item from CMS
 */
export interface CMSProduct {
  key: string;
  title: string;
  description: string;
  imageUrl: string | null;
  altText: string | null;
}

interface MediaRow {
  slot_key: string;
  file_name: string;
  storage_path: string;
  alt_text: string | null;
}

interface TextRow {
  section: string;
  key: string;
  value: string;
}

/**
 * Get CMS Products
 *
 * Fetches product images and texts from the CMS for the Products page.
 */
export async function getCMSProducts(): Promise<CMSProduct[]> {
  const supabase = await createClient();

  // Fetch product images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mediaData, error: mediaError } = await (supabase as any)
    .from("marketing_media")
    .select("slot_key, file_name, storage_path, alt_text")
    .eq("category", "product")
    .order("sort_order");

  if (mediaError) {
    console.error("Failed to fetch product media:", mediaError);
    return [];
  }

  // Fetch product texts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: textsData, error: textsError } = await (supabase as any)
    .from("marketing_texts")
    .select("section, key, value")
    .eq("category", "products")
    .eq("locale", "en");

  if (textsError) {
    console.error("Failed to fetch product texts:", textsError);
    return [];
  }

  // Build text map
  const textMap = new Map<string, string>();
  for (const text of (textsData as TextRow[]) || []) {
    textMap.set(`${text.section}.${text.key}`, text.value);
  }

  // Build products list
  const products: CMSProduct[] = [];

  for (const media of (mediaData as MediaRow[]) || []) {
    // Skip products without images
    if (!media.file_name) continue;

    const key = media.slot_key;
    const storagePath = media.storage_path;

    // Get public URL for the image
    const { data: urlData } = supabase.storage
      .from("marketing")
      .getPublicUrl(storagePath + media.file_name);

    products.push({
      key,
      title: textMap.get(`${key}.title`) || key.replace("product-", "Product "),
      description: textMap.get(`${key}.description`) || "",
      imageUrl: urlData?.publicUrl || null,
      altText: media.alt_text,
    });
  }

  return products;
}
