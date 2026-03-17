/**
 * SL Hardwoods Scraper
 *
 * Scrapes solid wood panel prices from slhardwoods.co.uk.
 * Currently supports: https://www.slhardwoods.co.uk/product/solid-oak-furniture-panels-2/
 *
 * Modes:
 *   --discover   Parse product page and save all product variants to scraper_product_urls
 *   (default)    Scrape prices for products matching filter criteria
 *
 * Options:
 *   --output json     Output format (default: text)
 *   --file <path>     Write results to file (for push.ts)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SOURCE = "slhardwoods.co.uk";

// Product pages to scrape — add more pages here as needed
const PRODUCT_PAGES = [
  {
    url: "https://www.slhardwoods.co.uk/product/solid-oak-furniture-panels-2/",
    species: "oak",
    panelType: "FS",
    quality: "AB",
  },
];

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

// --- HTML Parsing ---

function parseVariantsFromHtml(html: string, page: typeof PRODUCT_PAGES[0]): ParsedVariant[] {
  const variants: ParsedVariant[] = [];

  // Match product variant table rows (pvt-tr class from WooCommerce variant table plugin)
  const rowRegex = /<tr[^>]*class=['"][^'"]*pvt-tr[^'"]*['"][^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  const rows: string[] = [];

  while ((match = rowRegex.exec(html)) !== null) {
    rows.push(match[1] ?? "");
  }

  // Fallback: any table row with dimension-like content
  if (rows.length === 0) {
    const fallbackRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((match = fallbackRegex.exec(html)) !== null) {
      const row = match[1] ?? "";
      if (/\d+\s*\([LWTh]+\)\s*x/i.test(row)) {
        rows.push(row);
      }
    }
  }

  for (const row of rows) {
    // Format: "1800 (L) x 600 (W) x 9 (Th) mm"
    const dimsMatch = row.match(
      /(\d+)\s*\([A-Za-z]+\)\s*x\s*(\d+)\s*\([A-Za-z]+\)\s*x\s*(\d+)\s*\([A-Za-z]+\)\s*mm/i
    );
    if (!dimsMatch) continue;

    const d1 = parseInt(dimsMatch[1] ?? "0", 10);
    const d2 = parseInt(dimsMatch[2] ?? "0", 10);
    const d3 = parseInt(dimsMatch[3] ?? "0", 10);
    // Sort to get thickness (smallest), width (middle), length (largest)
    const sorted = [d1, d2, d3].sort((a, b) => a - b);

    // Extract prices from WooCommerce variant table
    // Exc VAT: inside <span class="amount product-tax-off ...">...<span>&pound;</span>136.08</span>
    // Inc VAT: inside <span class="amount product-tax-on ...">...<span>&pound;</span>163.30</span>
    const excVatMatch = row.match(
      /product-tax-off[\s\S]*?&pound;<\/span>([\d,]+\.?\d*)/i
    );
    const incVatMatch = row.match(
      /product-tax-on[\s\S]*?&pound;<\/span>([\d,]+\.?\d*)/i
    );

    // Fallback: just find any £ amounts
    let excVat: number;
    let incVat: number;

    if (excVatMatch) {
      excVat = parseFloat(excVatMatch[1]!.replace(",", ""));
      incVat = incVatMatch
        ? parseFloat(incVatMatch[1]!.replace(",", ""))
        : Math.round(excVat * 1.2 * 100) / 100;
    } else {
      // Fallback: find all £ amounts
      const priceMatches = [...row.matchAll(/(?:£|&pound;)([\d,]+\.?\d*)/g)];
      if (priceMatches.length < 1) continue;
      incVat = parseFloat((priceMatches[0]?.[1] ?? "0").replace(",", ""));
      excVat = priceMatches.length >= 2
        ? parseFloat((priceMatches[1]?.[1] ?? "0").replace(",", ""))
        : Math.round((incVat / 1.2) * 100) / 100;
    }

    if (isNaN(excVat) || excVat === 0) continue;

    const thickness = sorted[0]!;
    const width = sorted[1]!;
    const length = sorted[2]!;

    variants.push({
      url: `${page.url}#${thickness}x${width}x${length}`,
      species: page.species,
      panelType: page.panelType,
      quality: page.quality,
      thickness_mm: thickness,
      width_mm: width,
      length_mm: length,
      price_inc_vat: isNaN(incVat) ? excVat * 1.2 : incVat,
      price_exc_vat: excVat,
    });
  }

  return variants;
}

// --- Database helpers ---

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// --- Discovery mode ---

async function discover() {
  console.log("=== SL Hardwoods — Discovery ===");
  console.log(`Discovering products from ${PRODUCT_PAGES.length} page(s)...\n`);

  const supabase = getSupabase();
  let totalFound = 0;

  for (const page of PRODUCT_PAGES) {
    console.log(`Visiting ${page.url}`);

    const response = await fetch(page.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TimberWorld/1.0)" },
    });

    if (!response.ok) {
      console.log(`  ERROR: HTTP ${response.status}`);
      continue;
    }

    const html = await response.text();
    const variants = parseVariantsFromHtml(html, page);
    console.log(`  Found ${variants.length} product variants`);

    for (const v of variants) {
      console.log(`  ${v.species} ${v.panelType} ${v.thickness_mm}x${v.width_mm}x${v.length_mm}mm ${v.quality} | £${v.price_exc_vat} excl VAT`);
    }

    // Upsert to scraper_product_urls
    for (const v of variants) {
      const { error } = await supabase
        .from("scraper_product_urls")
        .upsert(
          {
            source: SOURCE,
            url: v.url,
            species: v.species,
            panel_type: v.panelType,
            quality: v.quality,
            thickness_mm: v.thickness_mm,
            width_mm: v.width_mm,
            length_mm: v.length_mm,
            is_active: true,
          },
          { onConflict: "source,url" }
        );

      if (error) {
        console.error(`  Error saving URL: ${error.message}`);
      }
    }

    totalFound += variants.length;
  }

  console.log(`\n--- Discovery complete ---`);
  console.log(`Total: ${totalFound} product URLs saved to database`);
}

// --- Scrape mode ---

async function scrape(outputFile: string | null) {
  console.log("=== SL Hardwoods — Scraping ===");

  const supabase = getSupabase();

  // Load filter from environment (passed by API route)
  let filter: Record<string, string[] | number[]> | undefined;
  if (process.env.SCRAPER_FILTER) {
    try {
      filter = JSON.parse(process.env.SCRAPER_FILTER);
    } catch {
      // ignore
    }
  }

  // Load saved URLs with filters
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

  // Group by page URL (before the # fragment)
  const byPage = new Map<string, typeof savedUrls>();
  for (const u of savedUrls) {
    const pageUrl = u.url.split("#")[0];
    if (!byPage.has(pageUrl)) byPage.set(pageUrl, []);
    byPage.get(pageUrl)!.push(u);
  }

  const allProducts: ParsedVariant[] = [];

  for (const [pageUrl, targets] of byPage.entries()) {
    console.log(`\nScraping ${pageUrl} (${targets.length} products)`);

    // Find the page config
    const pageConfig = PRODUCT_PAGES.find((p) => p.url === pageUrl);
    if (!pageConfig) {
      console.log(`  Unknown page, skipping`);
      continue;
    }

    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TimberWorld/1.0)" },
    });

    if (!response.ok) {
      console.log(`  ERROR: HTTP ${response.status}`);
      continue;
    }

    const html = await response.text();
    const variants = parseVariantsFromHtml(html, pageConfig);
    console.log(`  Found ${variants.length} variants on page`);

    // Match scraped variants to target URLs
    for (const target of targets) {
      const matched = variants.find(
        (v) =>
          v.thickness_mm === target.thickness_mm &&
          v.width_mm === target.width_mm &&
          v.length_mm === target.length_mm
      );

      if (matched) {
        allProducts.push(matched);
        console.log(
          `  ${matched.species} ${matched.panelType} ${matched.thickness_mm}x${matched.width_mm}x${matched.length_mm}mm ${matched.quality} | £${matched.price_exc_vat} excl VAT`
        );
      } else {
        console.log(
          `  MISSING: ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm — not found on page`
        );
      }
    }
  }

  console.log(`\n--- Scraping complete ---`);
  console.log(`Total: ${allProducts.length} products scraped`);

  // Save results
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
