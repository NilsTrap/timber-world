/**
 * Fix consumed packages that still show in inventory
 *
 * Sets NGL-0001 through NGL-0005 to "consumed" status with pieces=0 and volume=0
 * These packages were fully consumed in the sanding process (30 Jan) but
 * still appear in inventory due to a previous revert/re-validation issue.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PACKAGE_NUMBERS = [
  // Gluing (2026-01-27)
  "N-PL-0001", "N-PL-0002", "N-PL-0003", "N-PL-0005", "N-PL-0006",
  // Filling (2026-02-03)
  "N-CR-0001", "N-CR-0002", "N-CR-0003", "N-CR-0004", "N-CR-0005", "N-CR-0006",
  // Crosscutting (2026-02-18)
  "N-MS-0017", "N-MS-0018", "N-MS-0019",
];

async function main() {
  // First, find the packages and show their current state
  const { data: packages, error: fetchError } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status, organisation_id, shipment_id, production_entry_id")
    .in("package_number", PACKAGE_NUMBERS);

  if (fetchError) {
    console.error("Failed to fetch packages:", fetchError);
    return;
  }

  if (!packages || packages.length === 0) {
    // Try without hyphen format
    const altNumbers = ["NGL0001", "NGL0002", "NGL0003", "NGL0004", "NGL0005"];
    const { data: altPackages, error: altError } = await supabase
      .from("inventory_packages")
      .select("id, package_number, pieces, volume_m3, status, organisation_id, shipment_id, production_entry_id")
      .in("package_number", altNumbers);

    if (altError) {
      console.error("Failed to fetch packages (alt):", altError);
      return;
    }

    if (!altPackages || altPackages.length === 0) {
      // Try with LIKE pattern
      const { data: likePackages, error: likeError } = await supabase
        .from("inventory_packages")
        .select("id, package_number, pieces, volume_m3, status, organisation_id, shipment_id, production_entry_id")
        .like("package_number", "%GL%00%");

      if (likeError) {
        console.error("Failed to fetch packages (like):", likeError);
        return;
      }

      console.log("Packages matching GL pattern:", JSON.stringify(likePackages, null, 2));
      return;
    }

    console.log("Found packages (alt format):");
    console.table(altPackages);
    return;
  }

  console.log("Found packages - current state:");
  console.table(packages);

  // Check if --dry-run flag is set
  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log("\n[DRY RUN] Would update these packages to: status=consumed, pieces=0, volume_m3=0");
    return;
  }

  // Update each package to consumed
  const packageIds = packages.map(p => p.id);
  const { error: updateError, count } = await supabase
    .from("inventory_packages")
    .update({ status: "consumed", pieces: "0", volume_m3: 0 })
    .in("id", packageIds);

  if (updateError) {
    console.error("Failed to update packages:", updateError);
    return;
  }

  console.log(`\nUpdated ${count ?? packageIds.length} packages to consumed status.`);

  // Verify
  const { data: verify } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status")
    .in("id", packageIds);

  console.log("\nVerification - updated state:");
  console.table(verify);
}

main().catch(console.error);
