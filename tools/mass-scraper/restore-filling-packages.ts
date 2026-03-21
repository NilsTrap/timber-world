/**
 * Restore the 6 filling output packages to inventory and link them to shipment INE-TWG-001.
 *
 * These packages were produced by the Filling process (2026-02-03) and shipped
 * via INE-TWG-001 (2026-02-09) from Inertse to The Wood and Good SIA.
 * They were accidentally deleted when the shipment was emptied.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FILLING_ENTRY_ID = "c04f3b97-6d47-4b33-9174-b9d0e70acf12";
const SHIPMENT_ID = "71b3ffa9-1709-4cd8-9b73-00a47fce8e06";
// TWG is the receiving org, so packages belong to TWG after shipment is completed
const TWG_ORG_ID = "c1bed4cb-4cfb-4827-84e0-432929fb59b2";

async function main() {
  // 1. Get production outputs with all reference IDs
  const { data: outputs, error: outputsError } = await supabase
    .from("portal_production_outputs")
    .select("package_number, pieces, volume_m3, thickness, width, length, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, notes")
    .eq("production_entry_id", FILLING_ENTRY_ID)
    .order("package_number", { ascending: true });

  if (outputsError || !outputs) {
    console.error("Failed to fetch outputs:", outputsError);
    return;
  }

  console.log("Packages to create:");
  console.table(outputs.map(o => ({
    pkg: o.package_number,
    pieces: o.pieces,
    vol: Number(o.volume_m3).toFixed(3),
    dims: `${o.thickness}x${o.width}x${o.length}`,
  })));

  const isDryRun = process.argv.includes("--dry-run");

  // 2. Build inventory package records
  const packages = outputs.map((o, i) => ({
    package_number: o.package_number,
    pieces: o.pieces,
    volume_m3: o.volume_m3,
    volume_is_calculated: false,
    thickness: o.thickness,
    width: o.width,
    length: o.length,
    product_name_id: o.product_name_id,
    wood_species_id: o.wood_species_id,
    humidity_id: o.humidity_id,
    type_id: o.type_id,
    processing_id: o.processing_id,
    fsc_id: o.fsc_id,
    quality_id: o.quality_id,
    notes: o.notes || null,
    status: "produced",
    organisation_id: TWG_ORG_ID,
    production_entry_id: FILLING_ENTRY_ID,
    shipment_id: SHIPMENT_ID,
    package_sequence: i + 1,
  }));

  if (isDryRun) {
    console.log("\n[DRY RUN] Would insert these packages into inventory_packages:");
    console.log(JSON.stringify(packages, null, 2));
    return;
  }

  // 3. Insert
  const { data: inserted, error: insertError } = await supabase
    .from("inventory_packages")
    .insert(packages)
    .select("id, package_number, pieces, volume_m3, status, shipment_id");

  if (insertError) {
    console.error("Failed to insert packages:", insertError);
    return;
  }

  console.log(`\nInserted ${inserted?.length ?? 0} packages:`);
  console.table(inserted?.map(p => ({
    pkg: p.package_number,
    pieces: p.pieces,
    vol: Number(p.volume_m3).toFixed(3),
    status: p.status,
    shipment: p.shipment_id,
  })));
}

main().catch(console.error);
