/**
 * Push scraped data to Supabase competitor_prices table
 *
 * Usage:
 *   npx tsx push.ts results.json           # Push JSON file to database
 *   npx tsx push.ts results.json --dry-run # Preview without inserting
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Types matching the scraper output
interface PanelProduct {
  name: string;
  productCode: string;
  species: string;
  thickness: number;
  width: number;
  length: number;
  quality: string;
  pricePerPiece: number;
  pricePerM2: number;
  stockTallinn: number;
  stockTartu: number;
  totalStock: number;
  url: string;
  scrapedAt: string;
}

// Database insert type
interface CompetitorPriceInsert {
  source: string;
  product_name: string;
  species: string;
  thickness_mm: number;
  width_mm: number;
  length_mm: number;
  quality: string | null;
  price_per_piece: number | null;
  price_per_m2: number | null;
  stock_total: number;
  stock_locations: Record<string, number>;
  product_url: string;
  scraped_at: string;
}

function parseArgs(): { inputFile: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let inputFile = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (!args[i].startsWith("-")) {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error("Usage: npx tsx push.ts <input.json> [--dry-run]");
    process.exit(1);
  }

  return { inputFile, dryRun };
}

function transformProduct(product: PanelProduct): CompetitorPriceInsert {
  return {
    source: "mass.ee",
    product_name: product.name,
    species: product.species || "oak",
    thickness_mm: product.thickness,
    width_mm: product.width,
    length_mm: product.length,
    quality: product.quality || null,
    price_per_piece: product.pricePerPiece || null,
    price_per_m2: product.pricePerM2 || null,
    stock_total: product.totalStock,
    stock_locations: {
      tallinn: product.stockTallinn,
      tartu: product.stockTartu,
    },
    product_url: product.url,
    scraped_at: product.scrapedAt,
  };
}

async function main() {
  const { inputFile, dryRun } = parseArgs();

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing environment variables");
    console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    console.error("");
    console.error("You can set these in a .env file or export them:");
    console.error("  export SUPABASE_URL=https://xxx.supabase.co");
    console.error("  export SUPABASE_SERVICE_ROLE_KEY=xxx");
    process.exit(1);
  }

  // Read input file
  console.log(`Reading: ${inputFile}`);
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(inputFile, "utf-8");
  let products: PanelProduct[];

  try {
    products = JSON.parse(rawData);
  } catch {
    console.error("Error: Invalid JSON in input file");
    process.exit(1);
  }

  if (!Array.isArray(products)) {
    console.error("Error: Input file must contain a JSON array");
    process.exit(1);
  }

  console.log(`Found ${products.length} products to push`);

  // Transform to database format
  const records = products.map(transformProduct);

  if (dryRun) {
    console.log("\n--- DRY RUN: Preview of records to insert ---\n");
    for (const record of records) {
      console.log(`  [${record.species}] ${record.thickness_mm}x${record.width_mm}x${record.length_mm}mm ${record.quality || "N/A"}`);
      console.log(`    Price: EUR ${record.price_per_piece}/pc, EUR ${record.price_per_m2}/m2`);
      console.log(`    Stock: ${record.stock_total} (TLN: ${record.stock_locations.tallinn}, TRT: ${record.stock_locations.tartu})`);
      console.log("");
    }
    console.log("--- Dry run complete. No data was inserted. ---");
    return;
  }

  // Connect to Supabase
  console.log("\nConnecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Insert records
  console.log(`Inserting ${records.length} records...`);

  const { data, error } = await supabase
    .from("competitor_prices")
    .insert(records)
    .select("id");

  if (error) {
    console.error("Error inserting records:", error.message);
    console.error("Details:", error.details);
    process.exit(1);
  }

  console.log(`Successfully inserted ${data?.length || 0} records`);

  // Summary
  const speciesCounts = records.reduce((acc, r) => {
    acc[r.species] = (acc[r.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const thicknesses = [...new Set(records.map((r) => r.thickness_mm))].sort(
    (a, b) => a - b
  );
  const totalStock = records.reduce((sum, r) => sum + r.stock_total, 0);
  const avgPrice =
    records.reduce((sum, r) => sum + (r.price_per_piece || 0), 0) /
    records.length;

  console.log("\nSummary:");
  console.log(`  Products: ${records.length}`);
  console.log(`  Species: ${Object.entries(speciesCounts).map(([s, c]) => `${s}: ${c}`).join(", ")}`);
  console.log(`  Thicknesses: ${thicknesses.map((t) => t + "mm").join(", ")}`);
  console.log(`  Total stock: ${totalStock} pieces`);
  console.log(`  Average price: EUR ${avgPrice.toFixed(2)}/piece`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
