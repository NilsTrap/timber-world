/**
 * Fetch Timber International pricing from Supabase
 * and update the competitor pricing comparison CSV
 */

import "dotenv/config";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

interface MassProduct {
  name: string;
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
}

interface InventoryPackage {
  thickness: string;
  width: string;
  length: string;
  unit_price_piece: number | null;
  unit_price_m2: number | null;
  wood_species: { value: string } | null;
  type: { value: string } | null;
  quality: { value: string } | null;
}

// Determine panel type from URL or name
function getPanelType(product: MassProduct): string {
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

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing environment variables");
    console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Load mass.ee products
  const massProducts: MassProduct[] = JSON.parse(
    fs.readFileSync("all-products.json", "utf-8")
  );

  console.log(`Loaded ${massProducts.length} mass.ee products`);

  // Fetch TI inventory packages with prices
  // TI = Timber International = TIM party
  const { data: packages, error } = await supabase
    .from("inventory_packages")
    .select(
      `
      thickness,
      width,
      length,
      unit_price_piece,
      unit_price_m2,
      wood_species:ref_wood_species(value),
      type:ref_types(value),
      quality:ref_quality(value)
    `
    )
    .not("unit_price_m2", "is", null);

  if (error) {
    console.error("Error fetching inventory:", error.message);
    process.exit(1);
  }

  console.log(`Fetched ${packages?.length || 0} inventory packages with prices`);

  // Create price lookup map
  const tiPrices = new Map<
    string,
    { pricePerPiece: number; pricePerM2: number }
  >();

  for (const pkg of packages || []) {
    const p = pkg as unknown as InventoryPackage;
    if (!p.wood_species?.value || !p.type?.value) continue;

    // Parse dimensions (handle range values like "1000-1500")
    const thickness = parseInt(p.thickness?.split("-")[0] || "0", 10);
    const width = parseInt(p.width?.split("-")[0] || "0", 10);
    const length = parseInt(p.length?.split("-")[0] || "0", 10);

    if (!thickness || !width || !length) continue;

    // Map type value to FJ/FS
    const panelType = p.type.value.toLowerCase().includes("fj")
      ? "FJ"
      : p.type.value.toLowerCase().includes("full")
        ? "FS"
        : p.type.value.toLowerCase().includes("stave")
          ? "FS"
          : "";

    if (!panelType) continue;

    const key = makeKey(p.wood_species.value, panelType, thickness, width, length);

    // Convert from cents to euros
    const pricePerPiece = p.unit_price_piece ? p.unit_price_piece / 100 : 0;
    const pricePerM2 = p.unit_price_m2 ? p.unit_price_m2 / 100 : 0;

    if (pricePerM2 > 0) {
      tiPrices.set(key, { pricePerPiece, pricePerM2 });
    }
  }

  console.log(`Created price lookup with ${tiPrices.size} entries`);

  // Print some sample keys for debugging
  console.log("\nSample TI price keys:");
  let count = 0;
  for (const [key, price] of tiPrices) {
    if (count++ < 10) {
      console.log(`  ${key}: €${price.pricePerM2.toFixed(2)}/m²`);
    }
  }

  // Sort products by species, then thickness, then width, then length
  massProducts.sort((a, b) => {
    if (a.species !== b.species) return a.species.localeCompare(b.species);
    if (a.thickness !== b.thickness) return a.thickness - b.thickness;
    if (a.width !== b.width) return a.width - b.width;
    return a.length - b.length;
  });

  // Create CSV
  const headers = [
    "Species",
    "Type",
    "Thickness (mm)",
    "Width (mm)",
    "Length (mm)",
    "Quality",
    "Mass.ee Price (€/pc)",
    "Mass.ee Price (€/m²)",
    "TI Price (€/pc)",
    "TI Price (€/m²)",
    "Price Diff (%)",
    "Mass.ee Stock",
    "Has TI Price",
  ];

  const rows: string[][] = [];
  let matchedCount = 0;

  for (const p of massProducts) {
    const panelType = getPanelType(p);
    const key = makeKey(p.species, panelType, p.thickness, p.width, p.length);
    const tiPrice = tiPrices.get(key);

    if (tiPrice) matchedCount++;

    // Calculate price difference if both prices available
    let priceDiff = "";
    if (tiPrice && tiPrice.pricePerM2 > 0 && p.pricePerM2 > 0) {
      const diff = ((p.pricePerM2 - tiPrice.pricePerM2) / tiPrice.pricePerM2) * 100;
      priceDiff = diff.toFixed(1);
    }

    rows.push([
      p.species.charAt(0).toUpperCase() + p.species.slice(1),
      panelType,
      String(p.thickness),
      String(p.width),
      String(p.length),
      p.quality || "N/A",
      p.pricePerPiece.toFixed(2),
      p.pricePerM2.toFixed(2),
      tiPrice ? tiPrice.pricePerPiece.toFixed(2) : "",
      tiPrice ? tiPrice.pricePerM2.toFixed(2) : "",
      priceDiff,
      String(p.totalStock),
      tiPrice ? "Yes" : "No",
    ]);
  }

  // Write CSV
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  fs.writeFileSync("competitor-pricing-comparison.csv", csvContent);
  console.log(
    `\nUpdated competitor-pricing-comparison.csv with ${rows.length} products`
  );
  console.log(`Matched ${matchedCount} products with TI prices`);

  // Print summary
  const speciesCounts: Record<string, number> = {};
  for (const p of massProducts) {
    speciesCounts[p.species] = (speciesCounts[p.species] || 0) + 1;
  }

  console.log("\nSummary:");
  console.log(`  Total products: ${massProducts.length}`);
  console.log(`  With TI prices: ${matchedCount}`);
  console.log(
    `  Species: ${Object.entries(speciesCounts)
      .map(([s, c]) => `${s}: ${c}`)
      .join(", ")}`
  );
}

main().catch(console.error);
