/**
 * Push scraped data to Supabase competitor_prices table
 *
 * Usage:
 *   npx tsx push.ts results.json           # Push JSON file to database
 *   npx tsx push.ts results.json --dry-run # Preview without inserting
 */

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
  price_per_m3: number | null;
  ti_price_per_piece: number | null;
  ti_price_per_m2: number | null;
  ti_price_per_m3: number | null;
  price_diff_percent: number | null;
  stock_total: number;
  stock_locations: Record<string, number>;
  product_url: string;
  scraped_at: string;
}

// TI inventory package from database
interface InventoryPackage {
  thickness: string;
  width: string;
  length: string;
  unit_price_piece: number | null;
  unit_price_m2: number | null;
  unit_price_m3: number | null;
  wood_species: { value: string } | null;
  type: { value: string } | null;
}

// TI price data
interface TIPrice {
  pricePerPiece: number;
  pricePerM2: number;
  pricePerM3: number;
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

// Determine panel type from URL or name
function getPanelType(product: PanelProduct): string {
  if (
    product.url.includes("sormjatk") ||
    product.name.toLowerCase().includes("sõrmjätk")
  ) {
    return "FJ";
  }
  if (
    product.url.includes("pikk-lamell") ||
    product.name.toLowerCase().includes("pikk lamell")
  ) {
    return "FS";
  }
  return "";
}

// Normalize species name for matching
function normalizeSpecies(species: string): string {
  return species.toLowerCase().replace(/european\s*/i, "").trim();
}

// Create product key for matching
function makeKey(
  species: string,
  panelType: string,
  thickness: number,
  width: number,
  length: number
): string {
  return `${normalizeSpecies(species)}-${panelType}-${thickness}x${width}x${length}`;
}

// Fetch TI prices from inventory_packages
async function fetchTIPrices(
  supabase: SupabaseClient
): Promise<Map<string, TIPrice>> {
  const { data: packages, error } = await supabase
    .from("inventory_packages")
    .select(
      `
      thickness,
      width,
      length,
      unit_price_piece,
      unit_price_m2,
      unit_price_m3,
      wood_species:ref_wood_species(value),
      type:ref_types(value)
    `
    )
    .not("unit_price_m2", "is", null);

  if (error) {
    console.error("Error fetching TI prices:", error.message);
    return new Map();
  }

  const tiPrices = new Map<string, TIPrice>();

  for (const pkg of packages || []) {
    const p = pkg as unknown as InventoryPackage;
    if (!p.wood_species?.value || !p.type?.value) continue;

    const thickness = parseInt(p.thickness?.split("-")[0] || "0", 10);
    const width = parseInt(p.width?.split("-")[0] || "0", 10);
    const length = parseInt(p.length?.split("-")[0] || "0", 10);

    if (!thickness || !width || !length) continue;

    const panelType = p.type.value.toLowerCase().includes("fj")
      ? "FJ"
      : p.type.value.toLowerCase().includes("full") ||
          p.type.value.toLowerCase().includes("stave")
        ? "FS"
        : "";

    if (!panelType) continue;

    const key = makeKey(p.wood_species.value, panelType, thickness, width, length);
    const pricePerPiece = p.unit_price_piece ? p.unit_price_piece / 100 : 0;
    const pricePerM2 = p.unit_price_m2 ? p.unit_price_m2 / 100 : 0;
    const pricePerM3 = p.unit_price_m3 ? p.unit_price_m3 / 100 : 0;

    if (pricePerM2 > 0) {
      tiPrices.set(key, { pricePerPiece, pricePerM2, pricePerM3 });
    }
  }

  return tiPrices;
}

// Calculate price per m³ from piece price and dimensions
function calculatePricePerM3(
  pricePerPiece: number,
  thickness: number,
  width: number,
  length: number
): number | null {
  if (!pricePerPiece || !thickness || !width || !length) return null;
  // Convert mm to m and calculate volume
  const volumeM3 = (thickness / 1000) * (width / 1000) * (length / 1000);
  if (volumeM3 <= 0) return null;
  return Math.round((pricePerPiece / volumeM3) * 100) / 100;
}

function transformProduct(
  product: PanelProduct,
  tiPrices: Map<string, TIPrice>
): CompetitorPriceInsert {
  const panelType = getPanelType(product);
  const key = makeKey(product.species, panelType, product.thickness, product.width, product.length);
  const tiPrice = tiPrices.get(key);

  let priceDiffPercent: number | null = null;
  if (tiPrice && tiPrice.pricePerM2 > 0 && product.pricePerM2 > 0) {
    priceDiffPercent =
      Math.round(((product.pricePerM2 - tiPrice.pricePerM2) / tiPrice.pricePerM2) * 1000) / 10;
  }

  // Calculate mass.ee price per m³ from dimensions
  const pricePerM3 = calculatePricePerM3(
    product.pricePerPiece,
    product.thickness,
    product.width,
    product.length
  );

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
    price_per_m3: pricePerM3,
    ti_price_per_piece: tiPrice?.pricePerPiece || null,
    ti_price_per_m2: tiPrice?.pricePerM2 || null,
    ti_price_per_m3: tiPrice?.pricePerM3 || null,
    price_diff_percent: priceDiffPercent,
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

  // Connect to Supabase
  console.log("\nConnecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Fetch TI prices for comparison
  console.log("Fetching TI prices from inventory...");
  const tiPrices = await fetchTIPrices(supabase);
  console.log(`Found ${tiPrices.size} TI price entries`);

  // Transform to database format with TI prices
  const records = products.map((p) => transformProduct(p, tiPrices));
  const matchedCount = records.filter((r) => r.ti_price_per_m2 !== null).length;
  console.log(`Matched ${matchedCount} products with TI prices`);

  if (dryRun) {
    console.log("\n--- DRY RUN: Preview of records to insert ---\n");
    for (const record of records.slice(0, 20)) {
      console.log(`  [${record.species}] ${record.thickness_mm}x${record.width_mm}x${record.length_mm}mm ${record.quality || "N/A"}`);
      console.log(`    Mass.ee: €${record.price_per_piece}/pc, €${record.price_per_m2}/m²`);
      if (record.ti_price_per_m2) {
        console.log(`    TI:      €${record.ti_price_per_piece}/pc, €${record.ti_price_per_m2}/m² (${record.price_diff_percent! > 0 ? "+" : ""}${record.price_diff_percent}%)`);
      } else {
        console.log(`    TI:      No match`);
      }
      console.log(`    Stock: ${record.stock_total} (TLN: ${record.stock_locations.tallinn}, TRT: ${record.stock_locations.tartu})`);
      console.log("");
    }
    if (records.length > 20) {
      console.log(`  ... and ${records.length - 20} more products\n`);
    }
    console.log("--- Dry run complete. No data was inserted. ---");
    return;
  }

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
