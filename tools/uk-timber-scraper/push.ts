/**
 * UK Timber Push Script
 *
 * Reads scraped results JSON and upserts to competitor_prices table.
 * Prices stored in GBP (exc VAT). TIM prices filled from stock_prices table (EUR).
 *
 * Usage:
 *   npx tsx push.ts <results-file>
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SOURCE = "uktimber.co.uk";
const GBP_TO_EUR = 1 / 0.9;

interface ScrapedProduct {
  url: string;
  species: string;
  panelType: string;
  quality: string;
  thickness_mm: number;
  width_mm: number;
  length_mm: number;
  price_inc_vat: number;
  price_exc_vat: number;
}

interface StockPriceEntry {
  species: string;
  panelType: string;
  quality: string;
  thicknessMin: number;
  thicknessMax: number;
  lengthMin: number;
  lengthMax: number;
  stockPrice: number;
}

function capitalize(s: string): string {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeForStockMatch(species: string, quality: string): { species: string; quality: string } {
  const lower = species.toLowerCase();
  let stockSpecies = capitalize(species);
  if (lower.includes("oak")) stockSpecies = "Oak";

  let stockQuality = quality;
  if (quality === "BC") stockQuality = "Rustic";

  return { species: stockSpecies, quality: stockQuality };
}

function findStockPriceM3(
  stockPrices: StockPriceEntry[],
  species: string,
  panelType: string,
  quality: string,
  thicknessMm: number,
  lengthMm: number
): number | null {
  const norm = normalizeForStockMatch(species, quality);
  const match = stockPrices.find(
    (sp) =>
      sp.species.toLowerCase() === norm.species.toLowerCase() &&
      sp.panelType === panelType &&
      sp.quality === norm.quality &&
      thicknessMm >= sp.thicknessMin &&
      thicknessMm <= sp.thicknessMax &&
      lengthMm >= sp.lengthMin &&
      lengthMm <= sp.lengthMax
  );
  return match && match.stockPrice > 0 ? match.stockPrice : null;
}

async function main() {
  const resultsFile = process.argv[2];
  if (!resultsFile) {
    console.error("Usage: npx tsx push.ts <results-file>");
    process.exit(1);
  }

  console.log(`Reading results from ${resultsFile}`);
  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
  console.log(`Found ${products.length} products to push`);

  if (products.length === 0) {
    console.log("Nothing to push.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load stock prices for TIM price comparison
  const { data: spData } = await supabase
    .from("stock_prices")
    .select("species, panel_type, quality, thickness, length_range, stock_price")
    .order("sort_order");

  const stockPrices: StockPriceEntry[] = (spData || []).map((row: any) => {
    let lengthMin = 0;
    let lengthMax = 99999;
    if (row.length_range !== "All" && row.length_range !== "-") {
      const parts = row.length_range.split("-");
      lengthMin = parseInt(parts[0], 10) || 0;
      lengthMax = parseInt(parts[1], 10) || lengthMin;
    }
    let thicknessMin = 0;
    let thicknessMax = 99999;
    if (row.thickness && row.thickness !== "All" && row.thickness !== "-") {
      const parts = row.thickness.split("-");
      thicknessMin = parseInt(parts[0], 10) || 0;
      thicknessMax = parseInt(parts[1], 10) || thicknessMin;
    }
    return {
      species: row.species,
      panelType: row.panel_type,
      quality: row.quality,
      thicknessMin,
      thicknessMax,
      lengthMin,
      lengthMax,
      stockPrice: Number(row.stock_price),
    };
  });

  console.log(`Loaded ${stockPrices.length} stock price entries`);

  let upserted = 0;
  let errors = 0;
  let matched = 0;

  for (const p of products) {
    const area_m2 = (p.width_mm / 1000) * (p.length_mm / 1000);
    const volume_m3 = (p.thickness_mm / 1000) * area_m2;
    const price_per_m2 = area_m2 > 0 ? Math.round((p.price_exc_vat / area_m2) * 100) / 100 : null;
    const price_per_m3 = volume_m3 > 0 ? Math.round((p.price_exc_vat / volume_m3) * 100) / 100 : null;

    // Find TIM stock price (EUR/m³)
    let ti_price_per_m3: number | null = null;
    let ti_price_per_piece: number | null = null;
    let ti_price_per_m2: number | null = null;
    let price_diff_percent: number | null = null;

    const stockM3 = findStockPriceM3(stockPrices, p.species, p.panelType, p.quality, p.thickness_mm, p.length_mm);
    if (stockM3) {
      ti_price_per_m3 = stockM3;
      ti_price_per_piece = Math.round(stockM3 * volume_m3 * 100) / 100;
      ti_price_per_m2 = Math.round(stockM3 * (p.thickness_mm / 1000) * 100) / 100;
      matched++;

      const competitorM3Eur = price_per_m3! * GBP_TO_EUR;
      price_diff_percent = Math.round(((ti_price_per_m3 - competitorM3Eur) / competitorM3Eur) * 1000) / 10;
    }

    const record = {
      source: SOURCE,
      product_name: `${capitalize(p.species)} ${p.panelType} ${p.quality} ${p.thickness_mm}x${p.width_mm}x${p.length_mm}mm`,
      product_url: p.url,
      species: capitalize(p.species),
      panel_type: p.panelType,
      quality: p.quality,
      thickness_mm: p.thickness_mm,
      width_mm: p.width_mm,
      length_mm: p.length_mm,
      price_per_piece: p.price_exc_vat,
      price_per_m2,
      price_per_m3,
      ti_price_per_piece,
      ti_price_per_m2,
      ti_price_per_m3,
      price_diff_percent,
      stock_total: 0,
      stock_locations: {},
      scraped_at: new Date().toISOString(),
    };

    const timInfo = ti_price_per_m3 ? ` | TIM €${ti_price_per_m3}/m³ (${price_diff_percent! > 0 ? "+" : ""}${price_diff_percent!.toFixed(1)}%)` : " | TIM: no match";
    console.log(
      `  Upserting: ${record.product_name} | £${p.price_exc_vat}/pc | £${price_per_m3}/m³${timInfo}`
    );

    const { error } = await supabase
      .from("competitor_prices")
      .upsert(record, { onConflict: "source,product_url" });

    if (error) {
      console.error(`  Error: ${error.message}`);
      errors++;
    } else {
      upserted++;
    }
  }

  console.log(`\n--- Push complete ---`);
  console.log(`Summary: ${upserted} upserted, ${errors} errors, ${matched}/${products.length} matched with TIM prices`);
}

main().catch(console.error);
