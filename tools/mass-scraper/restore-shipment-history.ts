import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find the INE-TWG-001 shipment
  const { data: ineShipment } = await supabase
    .from("shipments")
    .select("id, shipment_code")
    .eq("shipment_code", "INE-TWG-001")
    .single();

  if (!ineShipment) {
    console.error("INE-TWG-001 shipment not found");
    process.exit(1);
  }

  console.log(`Found INE-TWG-001: ${ineShipment.id}`);

  // Find the TWG-B12-001 shipment and its packages
  const { data: twgShipment } = await supabase
    .from("shipments")
    .select("id, shipment_code")
    .eq("shipment_code", "TWG-B12-001")
    .single();

  if (!twgShipment) {
    console.error("TWG-B12-001 shipment not found");
    process.exit(1);
  }

  console.log(`Found TWG-B12-001: ${twgShipment.id}`);

  // Get packages currently in TWG-B12-001
  const { data: packages } = await supabase
    .from("inventory_packages")
    .select("id, package_number")
    .eq("shipment_id", twgShipment.id);

  console.log(`\nPackages in TWG-B12-001: ${packages?.length || 0}`);
  for (const p of packages || []) {
    console.log(`  ${p.package_number}`);
  }

  if (!packages || packages.length === 0) {
    console.log("No packages to update");
    return;
  }

  // Set source_shipment_id to INE-TWG-001 for these packages
  console.log(`\nSetting source_shipment_id to INE-TWG-001 for ${packages.length} packages...`);

  const { error } = await supabase
    .from("inventory_packages")
    .update({ source_shipment_id: ineShipment.id })
    .eq("shipment_id", twgShipment.id);

  if (error) {
    console.error("Error updating packages:", error.message);
    process.exit(1);
  }

  console.log("Done! Packages now have source_shipment_id set.");

  // Verify
  const { count } = await supabase
    .from("inventory_packages")
    .select("*", { count: "exact", head: true })
    .eq("source_shipment_id", ineShipment.id);

  console.log(`\nVerification: ${count} packages now reference INE-TWG-001 as source`);
}

main().catch(console.error);
