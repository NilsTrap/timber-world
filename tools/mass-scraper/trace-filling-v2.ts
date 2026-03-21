import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Get the exact specs of the 6 filling outputs
  const { data: outputs } = await supabase
    .from("portal_production_outputs")
    .select("package_number, pieces, volume_m3, thickness, width, length")
    .eq("production_entry_id", "c04f3b97-6d47-4b33-9174-b9d0e70acf12")
    .order("package_number");

  console.log("Filling outputs specs:");
  console.table(outputs?.map(o => ({
    pkg: o.package_number,
    pieces: o.pieces,
    vol: Number(o.volume_m3).toFixed(3),
    thick: o.thickness,
    width: o.width,
    length: o.length,
  })));

  // 2. Search inventory for matches by each output's dimensions + pieces
  for (const o of outputs || []) {
    const { data: matches } = await supabase
      .from("inventory_packages")
      .select("id, package_number, pieces, volume_m3, status, thickness, width, length, shipment_id, production_entry_id, organisation_id")
      .eq("pieces", o.pieces)
      .eq("thickness", o.thickness)
      .eq("width", o.width)
      .eq("length", o.length);

    if (matches && matches.length > 0) {
      console.log(`\nMatches for ${o.package_number} (pieces=${o.pieces}, ${o.thickness}x${o.width}x${o.length}):`);
      console.table(matches.map(m => ({
        pkg: m.package_number,
        pieces: m.pieces,
        vol: Number(m.volume_m3).toFixed(3),
        status: m.status,
        shipment: m.shipment_id ?? "none",
        prodEntry: m.production_entry_id ?? "none",
        orgId: m.organisation_id,
      })));
    } else {
      console.log(`\nNo matches for ${o.package_number} (pieces=${o.pieces}, ${o.thickness}x${o.width}x${o.length})`);
    }
  }

  // 3. Check the empty shipment INE-TWG-001
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, shipment_code, status, shipment_date, from_organisation_id, to_organisation_id")
    .eq("shipment_code", "INE-TWG-001")
    .single();

  console.log("\nShipment INE-TWG-001:", JSON.stringify(shipment, null, 2));

  if (shipment) {
    const { data: shipPkgs } = await supabase
      .from("inventory_packages")
      .select("id, package_number")
      .eq("shipment_id", shipment.id);
    console.log("Packages in INE-TWG-001:", shipPkgs?.length ?? 0);
  }

  // 4. Find TVGA/Wooden Good org
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name, code")
    .ilike("code", "%TWG%");

  console.log("\nTWG organisations:", JSON.stringify(orgs, null, 2));

  // 5. If we found TWG org, check what packages they have that match these dimensions
  if (orgs && orgs.length > 0) {
    const twgOrgId = orgs[0].id;
    for (const o of outputs || []) {
      const { data: twgMatches } = await supabase
        .from("inventory_packages")
        .select("id, package_number, pieces, volume_m3, status, thickness, width, length, shipment_id, production_entry_id")
        .eq("organisation_id", twgOrgId)
        .eq("thickness", o.thickness)
        .eq("width", o.width)
        .eq("length", o.length);

      if (twgMatches && twgMatches.length > 0) {
        console.log(`\nTWG packages matching dimensions of ${o.package_number} (${o.thickness}x${o.width}x${o.length}):`);
        console.table(twgMatches.map(m => ({
          pkg: m.package_number,
          pieces: m.pieces,
          vol: Number(m.volume_m3).toFixed(3),
          status: m.status,
          shipment: m.shipment_id ?? "none",
          prodEntry: m.production_entry_id ?? "none",
        })));
      }
    }
  }
}

main().catch(console.error);
