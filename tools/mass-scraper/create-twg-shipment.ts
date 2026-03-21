/**
 * Create a shipment from TWG to B12 dated 2026-02-12 with the 6 N-FL packages.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TWG_ORG_ID = "c1bed4cb-4cfb-4827-84e0-432929fb59b2";

async function main() {
  // 1. Find B12 organisation
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name, code")
    .ilike("code", "%B12%");

  if (!orgs || orgs.length === 0) {
    // Try by name
    const { data: allOrgs } = await supabase
      .from("organisations")
      .select("id, name, code");
    console.log("All organisations:");
    console.table(allOrgs?.map(o => ({ code: o.code, name: o.name, id: o.id })));
    return;
  }

  console.log("B12 organisation:", JSON.stringify(orgs, null, 2));

  const b12OrgId = orgs[0].id;

  // 2. Find the 6 N-FL packages
  const packageNumbers = ["N-FL-0001", "N-FL-0002", "N-FL-0003", "N-FL-0004", "N-FL-0005", "N-FL-0006"];
  const { data: packages } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status")
    .in("package_number", packageNumbers)
    .eq("organisation_id", TWG_ORG_ID);

  console.log("\nPackages to ship:");
  console.table(packages?.map(p => ({
    pkg: p.package_number,
    pieces: p.pieces,
    vol: Number(p.volume_m3).toFixed(3),
    status: p.status,
  })));

  // 3. Check existing TWG shipment codes to determine next code
  const { data: existingShipments } = await supabase
    .from("shipments")
    .select("shipment_code")
    .eq("from_organisation_id", TWG_ORG_ID)
    .order("shipment_code", { ascending: false })
    .limit(5);

  console.log("\nExisting TWG outgoing shipments:");
  console.table(existingShipments);

  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log("\n[DRY RUN] Would create shipment TWG-B12-??? from TWG to B12 dated 2026-02-12");
    return;
  }

  // 4. Determine shipment code
  // Pattern: TWG-XXX-NNN based on existing codes
  const twgCodes = (existingShipments || [])
    .map(s => s.shipment_code)
    .filter(c => c.startsWith("TWG-B12-"));

  let nextNum = 1;
  if (twgCodes.length > 0) {
    const nums = twgCodes.map(c => parseInt(c.replace("TWG-B12-", ""), 10)).filter(n => !isNaN(n));
    if (nums.length > 0) nextNum = Math.max(...nums) + 1;
  }
  const shipmentCode = `TWG-B12-${String(nextNum).padStart(3, "0")}`;

  console.log(`\nCreating shipment: ${shipmentCode}`);

  // 5. Create the shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      shipment_code: shipmentCode,
      shipment_number: 52,
      from_organisation_id: TWG_ORG_ID,
      to_organisation_id: b12OrgId,
      shipment_date: "2026-02-12",
      status: "completed",
      completed_at: "2026-02-12T12:00:00Z",
    })
    .select("id, shipment_code, status")
    .single();

  if (shipmentError) {
    console.error("Failed to create shipment:", shipmentError);
    return;
  }

  console.log("Created shipment:", JSON.stringify(shipment, null, 2));

  // 6. Link packages to shipment and transfer ownership to B12
  const packageIds = packages!.map(p => p.id);
  const { error: updateError } = await supabase
    .from("inventory_packages")
    .update({
      shipment_id: shipment.id,
      organisation_id: b12OrgId,
    })
    .in("id", packageIds);

  if (updateError) {
    console.error("Failed to link packages:", updateError);
    return;
  }

  // Update package_sequence
  for (let i = 0; i < packageIds.length; i++) {
    await supabase
      .from("inventory_packages")
      .update({ package_sequence: i + 1 })
      .eq("id", packageIds[i]);
  }

  // 7. Verify
  const { data: verify } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status, shipment_id, organisation_id")
    .in("id", packageIds);

  console.log("\nVerification:");
  console.table(verify?.map(p => ({
    pkg: p.package_number,
    pieces: p.pieces,
    vol: Number(p.volume_m3).toFixed(3),
    status: p.status,
    shipment: p.shipment_id,
    org: p.organisation_id,
  })));
}

main().catch(console.error);
