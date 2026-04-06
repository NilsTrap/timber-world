"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";

export interface MarketingStockItem {
  id: string;
  package_number: string;
  organisation_code: string;
  product_name: string;
  species: string;
  humidity: string;
  type: string;
  quality: string;
  processing: string;
  fsc: string;
  thickness: string;
  width: string;
  length: string;
  pieces: number;
  volume_m3: number | null;
  unit_price_piece: number | null;
  unit_price_m3: number | null;
  unit_price_m2: number | null;
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Fetch consolidated marketing stock - all available inventory from marketing-enabled orgs
 */
export async function getMarketingStock(): Promise<ActionResult<MarketingStockItem[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  // Get marketing-enabled org IDs
  const { data: orgs, error: orgsError } = await supabase
    .from("organisations")
    .select("id")
    .eq("is_active", true)
    .eq("marketing_enabled", true)
    .eq("is_external", false);

  if (orgsError) {
    return { success: false, error: orgsError.message };
  }

  const orgIds = ((orgs || []) as { id: string }[]).map((o) => o.id);

  if (orgIds.length === 0) {
    return { success: true, data: [] };
  }

  // Fetch inventory packages from enabled orgs
  const { data: packages, error: pkgError } = await supabase
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      unit_price_piece,
      unit_price_m3,
      unit_price_m2,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value),
      organisations!inventory_packages_organisation_id_fkey(code)
    `)
    .eq("status", "available")
    .in("organisation_id", orgIds);

  if (pkgError) {
    return { success: false, error: pkgError.message };
  }

  const safeParseInt = (value: string | null): number => {
    if (!value) return 0;
    const parsed = parseInt(value.split("-")[0] || "0");
    return isNaN(parsed) ? 0 : parsed;
  };

  const items: MarketingStockItem[] = ((packages || []) as any[]).map((pkg) => ({
    id: pkg.id,
    package_number: pkg.package_number,
    organisation_code: pkg.organisations?.code || "-",
    product_name: pkg.ref_product_names?.value || "-",
    species: pkg.ref_wood_species?.value || "-",
    humidity: pkg.ref_humidity?.value || "-",
    type: pkg.ref_types?.value || "-",
    quality: pkg.ref_quality?.value || "-",
    processing: pkg.ref_processing?.value || "-",
    fsc: pkg.ref_fsc?.value || "-",
    thickness: pkg.thickness || "-",
    width: pkg.width || "-",
    length: pkg.length || "-",
    pieces: safeParseInt(pkg.pieces),
    volume_m3: pkg.volume_m3,
    unit_price_piece: pkg.unit_price_piece,
    unit_price_m3: pkg.unit_price_m3,
    unit_price_m2: pkg.unit_price_m2,
  }));

  // Sort: product → species → type → quality → thickness → width → length
  items.sort((a, b) => {
    return (
      a.product_name.localeCompare(b.product_name) ||
      a.species.localeCompare(b.species) ||
      a.type.localeCompare(b.type) ||
      a.quality.localeCompare(b.quality) ||
      safeParseInt(a.thickness) - safeParseInt(b.thickness) ||
      safeParseInt(a.width) - safeParseInt(b.width) ||
      safeParseInt(a.length) - safeParseInt(b.length)
    );
  });

  return { success: true, data: items };
}
