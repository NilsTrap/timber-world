import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find ALL shipments
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select(`
      id,
      shipment_code,
      status,
      from_organisation:organisations!shipments_from_party_id_fkey(code, name),
      to_organisation:organisations!shipments_to_party_id_fkey(code, name)
    `)
    .order("shipment_code");

  if (error) {
    console.error("Error fetching shipments:", error.message);
    process.exit(1);
  }

  console.log("=== ALL SHIPMENTS ===");
  for (const s of shipments || []) {
    // Count packages for this shipment
    const { count } = await supabase
      .from("inventory_packages")
      .select("*", { count: "exact", head: true })
      .eq("shipment_id", s.id);

    console.log(`${s.shipment_code} | ${(s.from_organisation as any)?.code} -> ${(s.to_organisation as any)?.code} | ${s.status} | ${count ?? 0} pkgs`);
  }

  // Get The Wood and Good org ID
  const { data: twgOrg } = await supabase
    .from("organisations")
    .select("id, code, name")
    .ilike("name", "%wood%good%")
    .single();

  if (twgOrg) {
    console.log(`\n=== THE WOOD AND GOOD (${twgOrg.code}) PACKAGES ===`);

    const { data: packages } = await supabase
      .from("inventory_packages")
      .select(`
        id,
        package_number,
        shipment_id,
        status
      `)
      .eq("organisation_id", twgOrg.id)
      .order("package_number");

    for (const p of packages || []) {
      console.log(`  ${p.package_number}: shipment_id=${p.shipment_id?.substring(0, 8)}..., status=${p.status}`);
    }
  }

  // Check packages in completed shipment TWG-B12-001
  const twgShipment = shipments?.find(s => s.shipment_code === "TWG-B12-001");
  if (twgShipment) {
    console.log(`\n=== PACKAGES IN TWG-B12-001 ===`);
    const { data: pkgs } = await supabase
      .from("inventory_packages")
      .select("id, package_number, status, organisation_id")
      .eq("shipment_id", twgShipment.id);

    for (const p of pkgs || []) {
      console.log(`  ${p.package_number}: status=${p.status}, org_id=${p.organisation_id?.substring(0, 8)}...`);
    }
  }
}

main().catch(console.error);
