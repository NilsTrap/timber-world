import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find pending shipments to external orgs
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select(`
      id,
      shipment_code,
      status,
      from_organisation:organisations!shipments_from_party_id_fkey(name),
      to_organisation:organisations!shipments_to_party_id_fkey(name, is_external)
    `)
    .eq("status", "pending");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Pending shipments:");
  for (const s of shipments || []) {
    const toExt = (s.to_organisation as any)?.is_external ? " [EXTERNAL]" : "";
    console.log(`  ${s.shipment_code}: ${(s.from_organisation as any)?.name} -> ${(s.to_organisation as any)?.name}${toExt}`);
  }

  // Find and update shipments to external orgs
  const toUpdate = (shipments || []).filter((s: any) => s.to_organisation?.is_external);

  if (toUpdate.length === 0) {
    console.log("\nNo pending shipments to external organizations found.");
    return;
  }

  console.log(`\nUpdating ${toUpdate.length} shipment(s) to completed...`);

  for (const s of toUpdate) {
    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", s.id);

    if (updateError) {
      console.error(`  Failed to update ${s.shipment_code}:`, updateError.message);
    } else {
      console.log(`  Done: ${s.shipment_code} updated to completed`);
    }
  }
}

main().catch(console.error);
