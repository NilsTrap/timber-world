/**
 * Timber Source Scraper
 *
 * Scrapes solid wood panel prices from timbersource.co.uk using Playwright
 * (Cloudflare-protected site requires a real browser).
 *
 * Category: https://www.timbersource.co.uk/timber-products/oak-panels
 *
 * Modes:
 *   --discover   Parse category + product pages, save variants to scraper_product_urls
 *   (default)    Scrape prices for products matching filter criteria
 *
 * Options:
 *   --file <path>     Write results to file (for push.ts)
 */

import "dotenv/config";
import { chromium, type Browser, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SOURCE = "timbersource.co.uk";
const CATEGORY_URL = "https://www.timbersource.co.uk/timber-products/oak-panels";
const DELAY_MS = 500;

interface ParsedVariant {
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

interface ProductLink {
  url: string;
  name: string;
  species: string;
  quality: string;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify product from its name/URL
 * e.g. "Prime AB Grade Solid European Oak Panel" → species: "oak", quality: "AB"
 *      "Rustic Grade Solid European Oak Panel" → species: "oak", quality: "Rustic"
 *      "Character Grade Solid European Oak Panel" → species: "oak", quality: "Character"
 */
function classifyProduct(name: string): { species: string; quality: string } | null {
  const lower = name.toLowerCase();

  // Skip non-panel products
  if (lower.includes("sample") || lower.includes("worktop") || lower.includes("shelf")) return null;

  let species = "oak";
  // Could add more species detection if needed

  let quality = "AB";
  if (lower.includes("rustic")) quality = "Rustic";
  else if (lower.includes("character")) quality = "Character";
  else if (lower.includes("prime") || lower.includes("a/b") || lower.includes("ab")) quality = "AB";
  else if (lower.includes("b/c") || lower.includes("bc")) quality = "BC";

  return { species, quality };
}

// --- Database helpers ---

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// --- Browser helpers ---

async function launchBrowser(): Promise<{ browser: Browser; page: Page }> {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-GB",
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  return { browser, page };
}

async function navigateTo(page: Page, url: string, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      // Wait a bit for Cloudflare challenge to resolve
      await sleep(2000);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  Navigation timeout (attempt ${attempt}/${retries}), retrying...`);
      await sleep(3000);
    }
  }
}

// --- Discovery mode ---

async function discover() {
  console.log("=== Timber Source — Discovery ===");
  console.log(`Fetching category page: ${CATEGORY_URL}\n`);

  const supabase = getSupabase();
  const { browser, page } = await launchBrowser();
  let totalFound = 0;

  try {
    await navigateTo(page, CATEGORY_URL);

    // All products are listed directly on the category page
    // Format: "18mm x 600mm x 1.8m - £192.27 Each"
    // or:     "30mm x 920mm x 1.5m - £491.36 Each"
    // Lengths can be in meters (1.8m) or mm (1800mm)
    const pageText = await page.evaluate(() => document.body?.innerText || "");

    // Detect VAT status
    const isExcVat =
      pageText.toLowerCase().includes("ex vat") ||
      pageText.toLowerCase().includes("exc vat") ||
      pageText.toLowerCase().includes("excl vat") ||
      pageText.toLowerCase().includes("excluding vat") ||
      pageText.toLowerCase().includes("+ vat") ||
      pageText.toLowerCase().includes("ex. vat");

    console.log(`Prices are ${isExcVat ? "exc" : "inc"} VAT`);

    // Page structure:
    //   Variant lines at top: "18mm x 600mm x 1.8m - £192.27 Each" (AB quality)
    //   Then: "Solid European Oak panels with a round edge" section (skip)
    //   Then: Made-to-order timber selector (not relevant)
    // All standard (non-round-edge) variants are AB/Prime grade.

    const lines = pageText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Skip round edge variants
      if (lower.includes("round edge")) continue;

      // Parse variant lines: "18mm x 600mm x 1.8m - £192.27 Each"
      const variantMatch = line.match(
        /(\d+)\s*mm\s*x\s*(\d+)\s*mm\s*x\s*(\d+(?:\.\d+)?)\s*(m|mm)\s*.*?£([\d,]+\.?\d*)/i
      );

      if (!variantMatch) continue;

      const thickness = parseInt(variantMatch[1]!, 10);
      const width = parseInt(variantMatch[2]!, 10);
      const lengthVal = parseFloat(variantMatch[3]!);
      const lengthUnit = variantMatch[4]!.toLowerCase();
      const length = lengthUnit === "m" ? Math.round(lengthVal * 1000) : lengthVal;
      const price = parseFloat(variantMatch[5]!.replace(",", ""));
      const quality = "AB";

      const excVat = isExcVat ? price : Math.round((price / 1.2) * 100) / 100;

      const variantUrl = `${CATEGORY_URL}#${thickness}x${width}x${length}x${quality}`;

      console.log(
        `  ${thickness}x${width}x${length}mm ${quality} | £${excVat.toFixed(2)} exc VAT`
      );

      const { error } = await supabase
        .from("scraper_product_urls")
        .upsert(
          {
            source: SOURCE,
            url: variantUrl,
            species: "oak",
            panel_type: "FS",
            quality,
            thickness_mm: thickness,
            width_mm: width,
            length_mm: length,
            is_active: true,
          },
          { onConflict: "source,url" }
        );

      if (error) {
        console.error(`    Error saving URL: ${error.message}`);
      }

      totalFound++;
    }
  } finally {
    await browser.close();
  }

  console.log(`\n--- Discovery complete ---`);
  console.log(`Total: ${totalFound} product URLs saved to database`);
}

// --- Scrape mode ---

async function scrape(outputFile: string | null) {
  console.log("=== Timber Source — Scraping ===");

  const supabase = getSupabase();

  // Load filter
  let filter: Record<string, string[] | number[]> | undefined;
  if (process.env.SCRAPER_FILTER) {
    try {
      filter = JSON.parse(process.env.SCRAPER_FILTER);
    } catch {}
  }

  let query = supabase
    .from("scraper_product_urls")
    .select("*")
    .eq("source", SOURCE)
    .eq("is_active", true);

  if (filter) {
    if (filter.species && (filter.species as string[]).length > 0) query = query.in("species", filter.species);
    if (filter.panelTypes && (filter.panelTypes as string[]).length > 0) query = query.in("panel_type", filter.panelTypes);
    if (filter.qualities && (filter.qualities as string[]).length > 0) query = query.in("quality", filter.qualities);
    if (filter.thicknesses && (filter.thicknesses as number[]).length > 0) query = query.in("thickness_mm", filter.thicknesses);
    if (filter.widths && (filter.widths as number[]).length > 0) query = query.in("width_mm", filter.widths);
    if (filter.lengths && (filter.lengths as number[]).length > 0) query = query.in("length_mm", filter.lengths);
  }

  const { data: savedUrls } = await query;
  if (!savedUrls || savedUrls.length === 0) {
    console.log("No saved URLs to scrape. Run discovery first.");
    return;
  }

  console.log(`Loaded ${savedUrls.length} URLs to scrape`);

  const { browser, page } = await launchBrowser();
  const allProducts: ParsedVariant[] = [];

  try {
    // All variants are on the single category page
    console.log(`\nScraping ${CATEGORY_URL}`);
    await navigateTo(page, CATEGORY_URL);
    await sleep(1000);

    const pageText = await page.evaluate(() => document.body?.innerText || "");

    // Detect VAT status
    const isExcVat =
      pageText.toLowerCase().includes("ex vat") ||
      pageText.toLowerCase().includes("exc vat") ||
      pageText.toLowerCase().includes("+ vat");

    console.log(`Prices are ${isExcVat ? "exc" : "inc"} VAT`);

    // Parse all variant lines from page text (same regex as discover)
    const pageVariants: { thickness: number; width: number; length: number; price: number }[] = [];
    const lines = pageText.split("\n").map((l) => l.trim());

    for (const line of lines) {
      if (line.toLowerCase().includes("round edge")) continue;

      const m = line.match(
        /(\d+)\s*mm\s*x\s*(\d+)\s*mm\s*x\s*(\d+(?:\.\d+)?)\s*(m|mm)\s*.*?£([\d,]+\.?\d*)/i
      );
      if (!m) continue;

      const thickness = parseInt(m[1]!, 10);
      const width = parseInt(m[2]!, 10);
      const lengthVal = parseFloat(m[3]!);
      const lengthUnit = m[4]!.toLowerCase();
      const length = lengthUnit === "m" ? Math.round(lengthVal * 1000) : lengthVal;
      const price = parseFloat(m[5]!.replace(",", ""));

      pageVariants.push({ thickness, width, length, price });
    }

    console.log(`Found ${pageVariants.length} variants on page`);

    // Match scraped variants to saved URL targets
    for (const target of savedUrls) {
      const matched = pageVariants.find(
        (v) =>
          v.thickness === target.thickness_mm &&
          v.width === target.width_mm &&
          v.length === target.length_mm
      );

      if (matched) {
        const excVat = isExcVat ? matched.price : Math.round((matched.price / 1.2) * 100) / 100;
        const incVat = isExcVat ? Math.round(matched.price * 1.2 * 100) / 100 : matched.price;

        allProducts.push({
          url: target.url,
          species: target.species,
          panelType: target.panel_type,
          quality: target.quality,
          thickness_mm: target.thickness_mm,
          width_mm: target.width_mm,
          length_mm: target.length_mm,
          price_inc_vat: incVat,
          price_exc_vat: excVat,
        });

        console.log(
          `  ${target.species} ${target.panel_type} ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm ${target.quality} | £${excVat.toFixed(2)} exc VAT`
        );
      } else {
        console.log(
          `  MISSING: ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm — not found on page`
        );
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n--- Scraping complete ---`);
  console.log(`Total: ${allProducts.length} products scraped`);

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(allProducts, null, 2));
    console.log(`Saved results to ${outputFile}`);
  }
}

// --- Main ---

const args = process.argv.slice(2);
const isDiscover = args.includes("--discover");
const fileIdx = args.indexOf("--file");
const outputFile = fileIdx >= 0 ? (args[fileIdx + 1] ?? null) : null;

if (isDiscover) {
  discover().catch(console.error);
} else {
  scrape(outputFile).catch(console.error);
}
