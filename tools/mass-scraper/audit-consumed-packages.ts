/**
 * Audit: Find packages that are used as inputs in validated production processes
 * but are NOT marked as "consumed" in the inventory.
 *
 * For each production input:
 * - If pieces_used >= package pieces (fully consumed) → status should be "consumed"
 * - Check if the package still shows as "produced" or other non-consumed status
 *
 * Reports grouped by production entry.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Inertse organisation ID (from previous queries)
const INERTSE_ORG_ID = "ff9feae5-423c-4c36-865d-f58c70b8c44e";

async function main() {
  // 1. Get all validated production entries for Inertse
  const { data: entries, error: entriesError } = await supabase
    .from("portal_production_entries")
    .select("id, status, production_date, ref_processes(code, value)")
    .eq("organisation_id", INERTSE_ORG_ID)
    .eq("status", "validated")
    .order("production_date", { ascending: true });

  if (entriesError) {
    console.error("Failed to fetch production entries:", entriesError);
    return;
  }

  console.log(`Found ${entries?.length ?? 0} validated production entries for Inertse\n`);

  if (!entries || entries.length === 0) return;

  // 2. For each entry, get inputs and check package statuses
  const problems: Array<{
    entryId: string;
    productionDate: string;
    processName: string;
    packageNumber: string;
    packageId: string;
    piecesUsed: number | null;
    volumeUsed: number;
    currentPieces: string;
    currentVolume: number;
    currentStatus: string;
    issue: string;
  }> = [];

  for (const entry of entries) {
    const processName = (entry as any).ref_processes?.value ?? "Unknown";
    const productionDate = (entry as any).production_date ?? "Unknown";

    // Get all inputs for this entry
    const { data: inputs, error: inputsError } = await supabase
      .from("portal_production_inputs")
      .select("id, package_id, pieces_used, volume_m3")
      .eq("production_entry_id", entry.id);

    if (inputsError || !inputs) continue;

    // Group inputs by package_id (same package can appear multiple times)
    const inputsByPackage = new Map<string, { totalPiecesUsed: number; totalVolumeUsed: number }>();
    for (const input of inputs) {
      const existing = inputsByPackage.get(input.package_id);
      if (existing) {
        existing.totalPiecesUsed += input.pieces_used ?? 0;
        existing.totalVolumeUsed += Number(input.volume_m3) || 0;
      } else {
        inputsByPackage.set(input.package_id, {
          totalPiecesUsed: input.pieces_used ?? 0,
          totalVolumeUsed: Number(input.volume_m3) || 0,
        });
      }
    }

    // Fetch current state of all input packages
    const packageIds = [...inputsByPackage.keys()];
    if (packageIds.length === 0) continue;

    const { data: packages, error: pkgError } = await supabase
      .from("inventory_packages")
      .select("id, package_number, pieces, volume_m3, status")
      .in("id", packageIds);

    if (pkgError || !packages) continue;

    for (const pkg of packages) {
      if (pkg.status === "consumed") continue; // Already correct

      const usage = inputsByPackage.get(pkg.id)!;
      const currentPieces = parseInt(pkg.pieces || "0", 10);
      const currentVolume = Number(pkg.volume_m3) || 0;

      // Determine if this package should be consumed
      // A package used as input in a validated process that still has non-consumed status is suspicious
      let issue = "";

      if (usage.totalPiecesUsed > 0) {
        // Pieces-based consumption - if all pieces were used, should be consumed
        // But we can't know original pieces count easily, so flag any non-consumed package
        // that is an input to a validated process
        issue = `Used ${usage.totalPiecesUsed} pieces (${usage.totalVolumeUsed.toFixed(3)} m³) in production, but status is "${pkg.status}" with ${currentPieces} pieces / ${currentVolume.toFixed(3)} m³ remaining`;
      } else {
        issue = `Used ${usage.totalVolumeUsed.toFixed(3)} m³ in production, but status is "${pkg.status}" with ${currentVolume.toFixed(3)} m³ remaining`;
      }

      problems.push({
        entryId: entry.id,
        productionDate,
        processName,
        packageNumber: pkg.package_number,
        packageId: pkg.id,
        piecesUsed: usage.totalPiecesUsed || null,
        volumeUsed: usage.totalVolumeUsed,
        currentPieces: pkg.pieces,
        currentVolume,
        currentStatus: pkg.status,
        issue,
      });
    }
  }

  if (problems.length === 0) {
    console.log("No problems found! All input packages in validated production entries are correctly marked as consumed.");
    return;
  }

  console.log(`Found ${problems.length} package(s) with incorrect status:\n`);

  // Group by production entry for readability
  const byEntry = new Map<string, typeof problems>();
  for (const p of problems) {
    const key = `${p.productionDate} | ${p.processName} | ${p.entryId}`;
    if (!byEntry.has(key)) byEntry.set(key, []);
    byEntry.get(key)!.push(p);
  }

  for (const [entryKey, pkgs] of byEntry) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Production: ${entryKey}`);
    console.log(`${"=".repeat(80)}`);
    console.table(pkgs.map(p => ({
      package: p.packageNumber,
      status: p.currentStatus,
      currentPieces: p.currentPieces,
      currentVolume: p.currentVolume.toFixed(3),
      piecesUsed: p.piecesUsed,
      volumeUsed: p.volumeUsed.toFixed(3),
    })));
  }

  console.log(`\n\nSUMMARY: ${problems.length} packages across ${byEntry.size} production entries need fixing.`);
}

main().catch(console.error);
