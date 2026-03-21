/**
 * Trace where output packages from a production entry are used downstream.
 *
 * Finds outputs of the crosscutting process (2026-02-18) and traces
 * if they appear as inputs in later production entries or in shipments.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Filling (2026-02-03)
const CROSSCUTTING_ENTRY_ID = "c04f3b97-6d47-4b33-9174-b9d0e70acf12";

async function main() {
  // 1. Get output packages from this production entry
  const { data: outputPkgs, error: outputError } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status, shipment_id")
    .eq("production_entry_id", CROSSCUTTING_ENTRY_ID)
    .order("package_number", { ascending: true });

  if (outputError) {
    console.error("Failed to fetch output packages:", outputError);
    return;
  }

  console.log(`Output packages from Crosscutting (2026-02-18):`);
  console.table(outputPkgs?.map(p => ({
    package: p.package_number,
    pieces: p.pieces,
    volume: Number(p.volume_m3).toFixed(3),
    status: p.status,
    shipmentId: p.shipment_id ?? "none",
  })));

  if (!outputPkgs || outputPkgs.length === 0) return;

  const outputIds = outputPkgs.map(p => p.id);

  // 2. Check if any are used as inputs in other production entries
  const { data: usedAsInputs, error: inputError } = await supabase
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3, production_entry_id")
    .in("package_id", outputIds);

  if (inputError) {
    console.error("Failed to check inputs:", inputError);
    return;
  }

  if (usedAsInputs && usedAsInputs.length > 0) {
    // Get production entry details
    const entryIds = [...new Set(usedAsInputs.map(i => i.production_entry_id))];
    const { data: entries } = await supabase
      .from("portal_production_entries")
      .select("id, status, production_date, ref_processes(code, value)")
      .in("id", entryIds);

    const entryMap = new Map((entries || []).map((e: any) => [e.id, e]));

    console.log(`\nUsed as inputs in downstream production entries:`);
    console.table(usedAsInputs.map(i => {
      const pkg = outputPkgs.find(p => p.id === i.package_id);
      const entry = entryMap.get(i.production_entry_id) as any;
      return {
        package: pkg?.package_number ?? i.package_id,
        piecesUsed: i.pieces_used,
        volumeUsed: Number(i.volume_m3).toFixed(3),
        inProcess: entry?.ref_processes?.value ?? "Unknown",
        processDate: entry?.production_date ?? "Unknown",
        processStatus: entry?.status ?? "Unknown",
        entryId: i.production_entry_id,
      };
    }));
  } else {
    console.log("\nNone of the output packages are used as inputs in other production entries.");
  }

  // 3. Check if any are in shipments
  const withShipment = outputPkgs.filter(p => p.shipment_id);
  if (withShipment.length > 0) {
    const shipmentIds = [...new Set(withShipment.map(p => p.shipment_id!))];
    const { data: shipments } = await supabase
      .from("shipments")
      .select("id, shipment_code, status, from_organisation_id, to_organisation_id, shipment_date")
      .in("id", shipmentIds);

    console.log(`\nPackages in shipments:`);
    console.table(withShipment.map(p => {
      const shipment = (shipments || []).find((s: any) => s.id === p.shipment_id) as any;
      return {
        package: p.package_number,
        shipmentCode: shipment?.shipment_code ?? "Unknown",
        shipmentStatus: shipment?.status ?? "Unknown",
        shipmentDate: shipment?.shipment_date ?? "Unknown",
      };
    }));
  } else {
    console.log("\nNone of the output packages are in any shipments.");
  }
}

main().catch(console.error);
