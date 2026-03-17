/**
 * Fiximer Scraper
 *
 * Scrapes solid oak panel prices from fiximer.co.uk using Playwright.
 * WooCommerce site — variation data is in form[data-product_variations].
 *
 * Category: https://fiximer.co.uk/product-category/oak-joinery-parts/
 *
 * Products (4 solid oak panel pages):
 *   - A/BC Grade 20mm (FS, AB, 650mm wide, 6 lengths)
 *   - Finger Joint 20mm (FJ, AB, 620mm wide, 4 lengths)
 *   - Rustic Grade 20mm (FS, Rustic, 650mm wide, 6 lengths)
 *   - A/BC Grade 40mm (FS, AB, 650x900mm, single product)
 *
 * Prices on site are inc VAT (UK consumer site).
 *
 * Modes:
 *   --discover   Parse product pages, save variants to scraper_product_urls
 *   (default)    Scrape prices for saved product URLs
 *
 * Options:
 *   --file <path>   Write results to file (for push.ts)
 */

import "dotenv/config";
import { chromium, type Browser, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SOURCE = "fiximer.co.uk";
const CATEGORY_URL = "https://fiximer.co.uk/product-category/oak-joinery-parts/";
const DELAY_MS = 1000;

/** Product pages to scrape */
const PRODUCT_PAGES = [
  {
    url: "https://fiximer.co.uk/product/a-bc-grade-solid-european-oak-panels-20mm/",
    species: "oak",
    panelType: "FS",
    quality: "AB",
    thickness_mm: 20,
    width_mm: 650,
  },
  {
    url: "https://fiximer.co.uk/product/finger-joint-grade-solid-european-oak-panels-20mm/",
    species: "oak",
    panelType: "FJ",
    quality: "AB",
    thickness_mm: 20,
    width_mm: 620,
  },
  {
    url: "https://fiximer.co.uk/product/rustic-grade-solid-european-oak-panels-20mm/",
    species: "oak",
    panelType: "FS",
    quality: "Rustic",
    thickness_mm: 20,
    width_mm: 650,
  },
  {
    url: "https://fiximer.co.uk/product/a-bc-grade-solid-european-oak-panels-40mm/",
    species: "oak",
    panelType: "FS",
    quality: "AB",
    thickness_mm: 40,
    width_mm: 650,
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

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function launchBrowser(): Promise<{ browser: Browser; page: Page }> {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-GB",
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(45000);
  return { browser, page };
}

/**
 * Parse length in mm from WooCommerce attribute slug.
 * Examples: "900mm" → 900, "1300mm-1-3m" → 1300, "2400mm" → 2400, "1100mm-1-1m" → 1100
 */
function parseLengthFromAttr(attr: string): number {
  const match = attr.match(/^(\d+)mm/);
  return match ? parseInt(match[1], 10) : 0;
}

// --- Discovery mode ---

async function discover() {
  console.log("=== Fiximer — Discovery ===");
  console.log(`Scanning ${PRODUCT_PAGES.length} product pages\n`);

  const supabase = getSupabase();
  const { browser, page } = await launchBrowser();
  let totalFound = 0;

  try {
    for (const product of PRODUCT_PAGES) {
      console.log(`\nProduct: ${product.url}`);
      console.log(`  ${product.species} ${product.panelType} ${product.quality} ${product.thickness_mm}mm x ${product.width_mm}mm`);

      try {
        await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000);
      } catch (err) {
        console.log(`  ERROR loading page: ${err}`);
        continue;
      }

      // Try to extract WooCommerce variation data
      const variationData = await page.evaluate(() => {
        const form = document.querySelector("form.variations_form");
        if (form) {
          const data = form.getAttribute("data-product_variations");
          if (data) return data;
        }
        return null;
      });

      if (variationData) {
        // Variable product — parse variations
        const variations = JSON.parse(variationData) as {
          attributes: Record<string, string>;
          display_price: number;
          display_regular_price: number;
        }[];

        for (const v of variations) {
          const lengthAttr = v.attributes.attribute_pa_length || "";
          const length_mm = parseLengthFromAttr(lengthAttr);
          if (!length_mm) {
            console.log(`  SKIP: cannot parse length from "${lengthAttr}"`);
            continue;
          }

          const price = v.display_price; // inc VAT (sale price)
          const excVat = Math.round((price / 1.2) * 100) / 100;
          const variantUrl = `${product.url}#${product.thickness_mm}x${product.width_mm}x${length_mm}`;

          console.log(`  ${product.thickness_mm}x${product.width_mm}x${length_mm}mm | £${excVat.toFixed(2)} exc VAT (£${price.toFixed(2)} inc)`);

          const { error } = await supabase
            .from("scraper_product_urls")
            .upsert(
              {
                source: SOURCE,
                url: variantUrl,
                species: product.species,
                panel_type: product.panelType,
                quality: product.quality,
                thickness_mm: product.thickness_mm,
                width_mm: product.width_mm,
                length_mm,
                is_active: true,
              },
              { onConflict: "source,url" }
            );

          if (error) console.error(`    Error saving: ${error.message}`);
          totalFound++;
        }
      } else {
        // Simple product — single variant
        const price = await page.evaluate(() => {
          const el = document.querySelector(".woocommerce-Price-amount");
          if (!el) return null;
          const text = el.textContent || "";
          const match = text.match(/£([\d,.]+)/);
          return match ? parseFloat(match[1].replace(",", "")) : null;
        });

        if (!price) {
          console.log("  SKIP: cannot find price");
          continue;
        }

        // For 40mm panel, the page states length = 900mm
        const length_mm = 900;
        const excVat = Math.round((price / 1.2) * 100) / 100;
        const variantUrl = `${product.url}#${product.thickness_mm}x${product.width_mm}x${length_mm}`;

        console.log(`  ${product.thickness_mm}x${product.width_mm}x${length_mm}mm | £${excVat.toFixed(2)} exc VAT (£${price.toFixed(2)} inc)`);

        const { error } = await supabase
          .from("scraper_product_urls")
          .upsert(
            {
              source: SOURCE,
              url: variantUrl,
              species: product.species,
              panel_type: product.panelType,
              quality: product.quality,
              thickness_mm: product.thickness_mm,
              width_mm: product.width_mm,
              length_mm,
              is_active: true,
            },
            { onConflict: "source,url" }
          );

        if (error) console.error(`    Error saving: ${error.message}`);
        totalFound++;
      }

      await sleep(DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n--- Discovery complete ---`);
  console.log(`Total: ${totalFound} product URLs saved to database`);
}

// --- Scrape mode ---

async function scrape(outputFile: string | null) {
  console.log("=== Fiximer — Scraping ===");

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
  }

  const { data: savedUrls } = await query;
  if (!savedUrls || savedUrls.length === 0) {
    console.log("No saved URLs to scrape. Run discovery first.");
    return;
  }

  console.log(`Loaded ${savedUrls.length} URLs to scrape`);

  // Group by product page URL (strip fragment)
  const byPage = new Map<string, typeof savedUrls>();
  for (const u of savedUrls) {
    const pageUrl = u.url.split("#")[0];
    if (!byPage.has(pageUrl)) byPage.set(pageUrl, []);
    byPage.get(pageUrl)!.push(u);
  }

  const { browser, page } = await launchBrowser();
  const allProducts: ParsedVariant[] = [];

  try {
    for (const [pageUrl, targets] of byPage.entries()) {
      console.log(`\nScraping ${pageUrl} (${targets.length} variants)`);

      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000);
      } catch (err) {
        console.log(`  ERROR: ${err}`);
        continue;
      }

      // Extract variation data
      const variationData = await page.evaluate(() => {
        const form = document.querySelector("form.variations_form");
        if (form) {
          const data = form.getAttribute("data-product_variations");
          if (data) return data;
        }
        return null;
      });

      if (variationData) {
        const variations = JSON.parse(variationData) as {
          attributes: Record<string, string>;
          display_price: number;
        }[];

        // Build lookup: length_mm → price
        const priceByLength = new Map<number, number>();
        for (const v of variations) {
          const lengthAttr = v.attributes.attribute_pa_length || "";
          const len = parseLengthFromAttr(lengthAttr);
          if (len) priceByLength.set(len, v.display_price);
        }

        for (const target of targets) {
          const price = priceByLength.get(target.length_mm);
          if (price != null) {
            const excVat = Math.round((price / 1.2) * 100) / 100;
            allProducts.push({
              url: target.url,
              species: target.species,
              panelType: target.panel_type,
              quality: target.quality,
              thickness_mm: target.thickness_mm,
              width_mm: target.width_mm,
              length_mm: target.length_mm,
              price_inc_vat: price,
              price_exc_vat: excVat,
            });
            console.log(
              `  ${target.species} ${target.panel_type} ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm ${target.quality} | £${excVat.toFixed(2)} exc VAT`
            );
          } else {
            console.log(
              `  MISSING: ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm — not found`
            );
          }
        }
      } else {
        // Simple product
        const price = await page.evaluate(() => {
          const el = document.querySelector(".woocommerce-Price-amount");
          if (!el) return null;
          const text = el.textContent || "";
          const match = text.match(/£([\d,.]+)/);
          return match ? parseFloat(match[1].replace(",", "")) : null;
        });

        if (price != null) {
          for (const target of targets) {
            const excVat = Math.round((price / 1.2) * 100) / 100;
            allProducts.push({
              url: target.url,
              species: target.species,
              panelType: target.panel_type,
              quality: target.quality,
              thickness_mm: target.thickness_mm,
              width_mm: target.width_mm,
              length_mm: target.length_mm,
              price_inc_vat: price,
              price_exc_vat: excVat,
            });
            console.log(
              `  ${target.species} ${target.panel_type} ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm ${target.quality} | £${excVat.toFixed(2)} exc VAT`
            );
          }
        } else {
          console.log("  ERROR: cannot find price on page");
        }
      }

      await sleep(DELAY_MS);
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
