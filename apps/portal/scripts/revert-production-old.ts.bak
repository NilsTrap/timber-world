/**
 * Script to revert a failed production validation
 * Run with: npx tsx scripts/revert-production.ts
 */

import { createClient } from "@timber/database/client";

const PRODUCTION_ENTRY_ID = "213f0974-5cdb-4a8e-adb3-6d61c6f38d1e";

async function revertProduction() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.log("Make sure you have these in your .env.local file");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`\nReverting production entry: ${PRODUCTION_ENTRY_ID}\n`);

  // 1. Fetch entry
  const { data: entry, error: entryError } = await supabase
    .from("portal_production_entries")
    .select("id, status")
    .eq("id", PRODUCTION_ENTRY_ID)
    .single();

  if (entryError || !entry) {
    console.error("Entry not found:", entryError?.message);
    process.exit(1);
  }

  console.log(`Entry status: ${entry.status}`);

  // 2. Fetch inputs
  const { data: inputs, error: inputsError } = await supabase
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3")
    .eq("production_entry_id", PRODUCTION_ENTRY_ID);

  if (inputsError) {
    console.error("Failed to fetch inputs:", inputsError.message);
    process.exit(1);
  }

  console.log(`Found ${inputs?.length || 0} input(s)`);

  // 3. Restore each input package
  let restoredCount = 0;
  for (const input of inputs || []) {
    const { data: pkg, error: pkgError } = await supabase
      .from("inventory_packages")
      .select("id, package_number, pieces, volume_m3, status")
      .eq("id", input.package_id)
      .single();

    if (pkgError || !pkg) {
      console.error(`  Package not found: ${input.package_id}`);
      continue;
    }

    console.log(`\n  Package: ${pkg.package_number}`);
    console.log(`    Current: pieces=${pkg.pieces}, volume=${pkg.volume_m3}, status=${pkg.status}`);
    console.log(`    Input used: pieces=${input.pieces_used}, volume=${input.volume_m3}`);

    if (input.pieces_used && input.pieces_used > 0) {
      const currentPieces = parseInt(pkg.pieces || "0", 10);
      const restoredPieces = currentPieces + input.pieces_used;

      // Calculate restored volume proportionally
      let restoredVolume = Number(pkg.volume_m3) || 0;
      if (currentPieces > 0) {
        const ratio = restoredPieces / currentPieces;
        restoredVolume = restoredVolume * ratio;
      } else if (input.volume_m3) {
        // If current pieces is 0, add back the input volume
        restoredVolume = restoredVolume + Number(input.volume_m3);
      }

      const newStatus = pkg.status === "consumed" ? "produced" : pkg.status;

      console.log(`    Restoring to: pieces=${restoredPieces}, volume=${restoredVolume.toFixed(3)}, status=${newStatus}`);

      const { error: updateError } = await supabase
        .from("inventory_packages")
        .update({
          pieces: String(restoredPieces),
          volume_m3: restoredVolume,
          status: newStatus,
        })
        .eq("id", pkg.id);

      if (updateError) {
        console.error(`    Failed to restore: ${updateError.message}`);
      } else {
        console.log(`    ✓ Restored`);
        restoredCount++;
      }
    } else if (input.volume_m3 && Number(input.volume_m3) > 0) {
      const currentVolume = Number(pkg.volume_m3) || 0;
      const restoredVolume = currentVolume + Number(input.volume_m3);
      const newStatus = pkg.status === "consumed" ? "produced" : pkg.status;

      console.log(`    Restoring to: volume=${restoredVolume.toFixed(3)}, status=${newStatus}`);

      const { error: updateError } = await supabase
        .from("inventory_packages")
        .update({
          volume_m3: restoredVolume,
          status: newStatus,
        })
        .eq("id", pkg.id);

      if (updateError) {
        console.error(`    Failed to restore: ${updateError.message}`);
      } else {
        console.log(`    ✓ Restored`);
        restoredCount++;
      }
    }
  }

  // 4. Delete any output inventory packages created from this entry
  const { data: deletedOutputs, error: deleteError } = await supabase
    .from("inventory_packages")
    .delete()
    .eq("production_entry_id", PRODUCTION_ENTRY_ID)
    .select("id, package_number");

  if (deleteError) {
    console.error("\nFailed to delete output packages:", deleteError.message);
  } else {
    console.log(`\nDeleted ${deletedOutputs?.length || 0} output package(s)`);
    for (const pkg of deletedOutputs || []) {
      console.log(`  - ${pkg.package_number}`);
    }
  }

  // 5. Reset entry status to draft
  const { error: updateEntryError } = await supabase
    .from("portal_production_entries")
    .update({
      status: "draft",
      validated_at: null,
      total_input_m3: null,
      total_output_m3: null,
      outcome_percentage: null,
      waste_percentage: null,
    })
    .eq("id", PRODUCTION_ENTRY_ID);

  if (updateEntryError) {
    console.error("\nFailed to reset entry status:", updateEntryError.message);
    process.exit(1);
  }

  console.log(`\n✓ Entry status reset to "draft"`);
  console.log(`\n========================================`);
  console.log(`Revert complete!`);
  console.log(`  - Restored ${restoredCount} input package(s)`);
  console.log(`  - Deleted ${deletedOutputs?.length || 0} output package(s)`);
  console.log(`========================================\n`);
}

revertProduction().catch(console.error);
