import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get count before cleanup
  const { count: beforeCount } = await supabase
    .from("competitor_prices")
    .select("*", { count: "exact", head: true });

  console.log(`Records before cleanup: ${beforeCount}`);

  // Delete all records and re-insert fresh data
  const { error: deleteError } = await supabase
    .from("competitor_prices")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Delete error:", deleteError.message);
    process.exit(1);
  }

  console.log("Cleared all records");

  // Get count after cleanup
  const { count: afterCount } = await supabase
    .from("competitor_prices")
    .select("*", { count: "exact", head: true });

  console.log(`Records after cleanup: ${afterCount}`);
}

main().catch(console.error);
