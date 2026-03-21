/**
 * Trace output packages from the Filling process (2026-02-03)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FILLING_ENTRY_ID = "c04f3b97-6d47-4b33-9174-b9d0e70acf12";

async function main() {
  // 1. Check the production entry itself
  const { data: entry } = await supabase
    .from("portal_production_entries")
    .select("id, status, production_date, total_input_m3, total_output_m3, ref_processes(code, value)")
    .eq("id", FILLING_ENTRY_ID)
    .single();

  console.log("Production entry:");
  console.log(JSON.stringify(entry, null, 2));

  // 2. Check production outputs (draft table)
  const { data: outputs } = await supabase
    .from("portal_production_outputs")
    .select("id, package_number, pieces, volume_m3")
    .eq("production_entry_id", FILLING_ENTRY_ID)
    .order("package_number", { ascending: true });

  console.log(`\nProduction outputs (draft table): ${outputs?.length ?? 0}`);
  if (outputs && outputs.length > 0) {
    console.table(outputs.map(o => ({
      package: o.package_number,
      pieces: o.pieces,
      volume: Number(o.volume_m3).toFixed(3),
    })));
  }

  // 3. Check inventory packages linked to this entry
  const { data: invPkgs } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status, shipment_id, organisation_id")
    .eq("production_entry_id", FILLING_ENTRY_ID)
    .order("package_number", { ascending: true });

  console.log(`\nInventory packages linked to this entry: ${invPkgs?.length ?? 0}`);
  if (invPkgs && invPkgs.length > 0) {
    console.table(invPkgs.map(p => ({
      package: p.package_number,
      pieces: p.pieces,
      volume: Number(p.volume_m3).toFixed(3),
      status: p.status,
      shipmentId: p.shipment_id ?? "none",
    })));

    // 4. Check if any are used as inputs downstream
    const ids = invPkgs.map(p => p.id);
    const { data: usedAsInputs } = await supabase
      .from("portal_production_inputs")
      .select("id, package_id, pieces_used, volume_m3, production_entry_id")
      .in("package_id", ids);

    if (usedAsInputs && usedAsInputs.length > 0) {
      const entryIds = [...new Set(usedAsInputs.map(i => i.production_entry_id))];
      const { data: entries } = await supabase
        .from("portal_production_entries")
        .select("id, status, production_date, ref_processes(code, value)")
        .in("id", entryIds);

      const entryMap = new Map((entries || []).map((e: any) => [e.id, e]));

      console.log(`\nUsed as inputs in downstream production:`);
      console.table(usedAsInputs.map(i => {
        const pkg = invPkgs.find(p => p.id === i.package_id);
        const e = entryMap.get(i.production_entry_id) as any;
        return {
          package: pkg?.package_number,
          piecesUsed: i.pieces_used,
          volumeUsed: Number(i.volume_m3).toFixed(3),
          process: e?.ref_processes?.value ?? "Unknown",
          date: e?.production_date,
          status: e?.status,
        };
      }));
    } else {
      console.log("\nNot used as inputs in any downstream production.");
    }

    // 5. Check shipments
    const withShipment = invPkgs.filter(p => p.shipment_id);
    if (withShipment.length > 0) {
      const shipmentIds = [...new Set(withShipment.map(p => p.shipment_id!))];
      const { data: shipments } = await supabase
        .from("shipments")
        .select("id, shipment_code, status, shipment_date")
        .in("id", shipmentIds);

      console.log(`\nIn shipments:`);
      console.table(withShipment.map(p => {
        const s = (shipments || []).find((s: any) => s.id === p.shipment_id) as any;
        return {
          package: p.package_number,
          shipmentCode: s?.shipment_code,
          shipmentStatus: s?.status,
          shipmentDate: s?.shipment_date,
        };
      }));
    }
  }

  // 6. Also search by package number pattern N-FI-* in case they were unlinked
  const { data: fiPkgs } = await supabase
    .from("inventory_packages")
    .select("id, package_number, pieces, volume_m3, status, shipment_id, production_entry_id")
    .like("package_number", "N-FI-%")
    .order("package_number", { ascending: true });

  if (fiPkgs && fiPkgs.length > 0) {
    console.log(`\nAll N-FI-* packages in inventory:`);
    console.table(fiPkgs.map(p => ({
      package: p.package_number,
      pieces: p.pieces,
      volume: Number(p.volume_m3).toFixed(3),
      status: p.status,
      shipmentId: p.shipment_id ?? "none",
      productionEntryId: p.production_entry_id ?? "none",
    })));
  }
}

main().catch(console.error);
