/**
 * UK Timber Scraper
 *
 * Scrapes solid wood panel prices from uk-timber.co.uk (PrestaShop).
 * Category: https://www.uk-timber.co.uk/412-solid-oak-furniture-panels
 *
 * Modes:
 *   --discover   Parse category + product pages and save all variants to scraper_product_urls
 *   (default)    Scrape prices for products matching filter criteria
 *
 * Options:
 *   --output json     Output format (default: text)
 *   --file <path>     Write results to file (for push.ts)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SOURCE = "uktimber.co.uk";
const CATEGORY_URL = "https://www.uk-timber.co.uk/412-solid-oak-furniture-panels";
const DELAY_MS = 300;

// Known products with their species/quality mappings
const PRODUCT_MAPPINGS: Record<string, { species: string; quality: string }> = {
  "solid-european-oak-ab-grade": { species: "oak", quality: "AB" },
  "solid-european-oak-bc-grade": { species: "oak", quality: "BC" },
  "solid-rustic-european-oak": { species: "oak", quality: "Rustic" },
  "solid-american-white-oak-ab-grade": { species: "oak american", quality: "AB" },
  "solid-american-white-oak-bc-grade": { species: "oak american", quality: "BC" },
  "solid-american-white-oak-rustic": { species: "oak american", quality: "Rustic" },
  "solid-american-red-oak-ab-grade": { species: "oak red", quality: "AB" },
  "solid-american-red-oak-bc-grade": { species: "oak red", quality: "BC" },
  "solid-rustic-american-red-oak": { species: "oak red", quality: "Rustic" },
};

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

interface ProductOption {
  valueId: string;
  title: string;
}

interface ProductPageInfo {
  productId: string;
  url: string;
  species: string;
  quality: string;
  thicknesses: ProductOption[];
  lengths: ProductOption[];
  widths: ProductOption[];
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TimberWorld/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

async function fetchAjaxPrice(
  productUrl: string,
  productId: string,
  thicknessValueId: string,
  lengthValueId: string,
  widthValueId: string
): Promise<{ priceExcVat: number; quantity: number } | null> {
  const body = new URLSearchParams({
    ajax: "1",
    action: "refresh",
    id_product: productId,
    id_product_attribute: "0",
    "group[337]": thicknessValueId,
    "group[338]": lengthValueId,
    "group[339]": widthValueId,
    quantity_wanted: "1",
  });

  const response = await fetch(productUrl, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TimberWorld/1.0)",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body.toString(),
  });

  if (!response.ok) return null;

  try {
    const json = await response.json();

    // Try to extract price from product_details data-product JSON
    const detailsHtml: string = json.product_details ?? "";
    const dataProductMatch = detailsHtml.match(/data-product=['"](.*?)['"]/s);
    if (dataProductMatch) {
      // The JSON is HTML-encoded in the attribute
      const decoded = dataProductMatch[1]!
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#039;/g, "'");
      try {
        const productData = JSON.parse(decoded);
        const price = productData.price_amount ?? productData.price_tax_exc;
        const qty = productData.quantity ?? 0;
        if (typeof price === "number" && price > 0) {
          return { priceExcVat: price, quantity: qty };
        }
      } catch {
        // fall through to price_html parsing
      }
    }

    // Fallback: parse price from product_prices HTML
    const pricesHtml: string = json.product_prices ?? "";
    const priceMatch = pricesHtml.match(/£([\d,]+\.?\d*)/);
    if (priceMatch) {
      return {
        priceExcVat: parseFloat(priceMatch[1]!.replace(",", "")),
        quantity: 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function classifyProduct(urlSlug: string): { species: string; quality: string } | null {
  for (const [key, mapping] of Object.entries(PRODUCT_MAPPINGS)) {
    if (urlSlug.includes(key)) return mapping;
  }
  return null;
}

function extractProductId(url: string): string | null {
  // URL pattern: /solid-oak-furniture-panels/225900-solid-european-oak-...
  const match = url.match(/\/(\d+)-[^/]+\.html/);
  return match ? match[1]! : null;
}

// --- Parse product page ---

function parseProductPage(html: string): {
  thicknesses: ProductOption[];
  lengths: ProductOption[];
  widths: ProductOption[];
} {
  const thicknesses: ProductOption[] = [];
  const lengths: ProductOption[] = [];
  const widths: ProductOption[] = [];

  // Thickness: radio inputs with data-product-attribute="337"
  const thicknessRegex = /data-product-attribute="337"[^>]*value="(\d+)"[^>]*title="(\d+)"/g;
  let match;
  while ((match = thicknessRegex.exec(html)) !== null) {
    thicknesses.push({ valueId: match[1]!, title: match[2]! });
  }

  // Length: select with data-product-attribute="338"
  const lengthSelectMatch = html.match(
    /data-product-attribute="338"[\s\S]*?<\/select>/
  );
  if (lengthSelectMatch) {
    const optionRegex = /value="(\d+)"[^>]*title="(\d+)"/g;
    while ((match = optionRegex.exec(lengthSelectMatch[0])) !== null) {
      lengths.push({ valueId: match[1]!, title: match[2]! });
    }
  }

  // Width: select with data-product-attribute="339"
  const widthSelectMatch = html.match(
    /data-product-attribute="339"[\s\S]*?<\/select>/
  );
  if (widthSelectMatch) {
    const optionRegex = /value="(\d+)"[^>]*title="(\d+)"/g;
    while ((match = optionRegex.exec(widthSelectMatch[0])) !== null) {
      widths.push({ valueId: match[1]!, title: match[2]! });
    }
  }

  return { thicknesses, lengths, widths };
}

// --- Parse category page ---

function parseCategoryPage(html: string): { url: string; name: string }[] {
  const products: { url: string; name: string }[] = [];

  // PrestaShop product links — URLs may have leading/trailing spaces inside href
  const linkRegex = /href="\s*(https:\/\/www\.uk-timber\.co\.uk\/solid-oak-furniture-panels\/\d+-[^"\s]+\.html)\s*"/gi;
  let match;
  const seen = new Set<string>();

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1]!.trim();
    if (!seen.has(url)) {
      seen.add(url);
      const slug = url.replace(/.*\/\d+-/, "").replace(/\.html$/, "");
      products.push({ url, name: slug });
    }
  }

  // Filter out sample listings
  return products.filter(
    (p) => !p.name.toLowerCase().includes("sample") && !p.url.toLowerCase().includes("sample")
  );
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
  console.log("=== UK Timber -- Discovery ===");
  console.log(`Fetching category page: ${CATEGORY_URL}\n`);

  const supabase = getSupabase();
  let totalFound = 0;

  // Fetch category page
  const categoryHtml = await fetchPage(CATEGORY_URL);
  const productLinks = parseCategoryPage(categoryHtml);
  console.log(`Found ${productLinks.length} product links on category page`);

  for (const link of productLinks) {
    const classification = classifyProduct(link.name);
    if (!classification) {
      console.log(`  Skipping unrecognized product: ${link.name}`);
      continue;
    }

    const productId = extractProductId(link.url);
    if (!productId) {
      console.log(`  Cannot extract product ID from: ${link.url}`);
      continue;
    }

    console.log(
      `\nProduct: ${link.name} (ID: ${productId}, species: ${classification.species}, quality: ${classification.quality})`
    );

    // Fetch product page to get options
    await sleep(DELAY_MS);
    let productHtml: string;
    try {
      productHtml = await fetchPage(link.url);
    } catch (err) {
      console.log(`  ERROR fetching product page: ${err}`);
      continue;
    }

    const options = parseProductPage(productHtml);
    console.log(
      `  Options: ${options.thicknesses.length} thicknesses, ${options.lengths.length} lengths, ${options.widths.length} widths`
    );

    if (options.thicknesses.length === 0 || options.lengths.length === 0 || options.widths.length === 0) {
      console.log("  WARNING: Missing option groups, skipping product");
      continue;
    }

    const totalCombinations =
      options.thicknesses.length * options.lengths.length * options.widths.length;
    console.log(`  Fetching prices for ${totalCombinations} combinations...`);

    let productVariants = 0;

    for (const thickness of options.thicknesses) {
      for (const length of options.lengths) {
        for (const width of options.widths) {
          await sleep(DELAY_MS);

          const result = await fetchAjaxPrice(
            link.url,
            productId,
            thickness.valueId,
            length.valueId,
            width.valueId
          );

          if (!result || result.priceExcVat <= 0) {
            console.log(
              `    ${thickness.title}x${width.title}x${length.title}mm -- no price (possibly unavailable)`
            );
            continue;
          }

          const thicknessMm = parseInt(thickness.title, 10);
          const lengthMm = parseInt(length.title, 10);
          const widthMm = parseInt(width.title, 10);

          const variantUrl = `${link.url}#${thicknessMm}x${widthMm}x${lengthMm}`;

          console.log(
            `    ${thicknessMm}x${widthMm}x${lengthMm}mm | £${result.priceExcVat.toFixed(2)} exc VAT | qty: ${result.quantity}`
          );

          // Upsert to scraper_product_urls
          const { error } = await supabase
            .from("scraper_product_urls")
            .upsert(
              {
                source: SOURCE,
                url: variantUrl,
                species: classification.species,
                panel_type: "FS",
                quality: classification.quality,
                thickness_mm: thicknessMm,
                width_mm: widthMm,
                length_mm: lengthMm,
                is_active: true,
              },
              { onConflict: "source,url" }
            );

          if (error) {
            console.error(`    Error saving URL: ${error.message}`);
          }

          productVariants++;
          totalFound++;
        }
      }
    }

    console.log(`  Saved ${productVariants} variants for this product`);
  }

  console.log(`\n--- Discovery complete ---`);
  console.log(`Total: ${totalFound} product URLs saved to database`);
}

// --- Scrape mode ---

async function scrape(outputFile: string | null) {
  console.log("=== UK Timber -- Scraping ===");

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

  // Group by product page URL (before the # fragment)
  const byPage = new Map<string, typeof savedUrls>();
  for (const u of savedUrls) {
    const pageUrl = u.url.split("#")[0];
    if (!byPage.has(pageUrl)) byPage.set(pageUrl, []);
    byPage.get(pageUrl)!.push(u);
  }

  const allProducts: ParsedVariant[] = [];

  for (const [pageUrl, targets] of byPage.entries()) {
    console.log(`\nScraping ${pageUrl} (${targets.length} variants)`);

    const productId = extractProductId(pageUrl);
    if (!productId) {
      console.log("  Cannot extract product ID, skipping");
      continue;
    }

    // Fetch product page to get option value IDs
    let productHtml: string;
    try {
      productHtml = await fetchPage(pageUrl);
    } catch (err) {
      console.log(`  ERROR: ${err}`);
      continue;
    }

    const options = parseProductPage(productHtml);
    if (options.thicknesses.length === 0 || options.lengths.length === 0 || options.widths.length === 0) {
      console.log("  WARNING: Missing option groups, skipping");
      continue;
    }

    // Build lookup maps: dimension value -> valueId
    const thicknessMap = new Map(options.thicknesses.map((o) => [parseInt(o.title, 10), o.valueId]));
    const lengthMap = new Map(options.lengths.map((o) => [parseInt(o.title, 10), o.valueId]));
    const widthMap = new Map(options.widths.map((o) => [parseInt(o.title, 10), o.valueId]));

    for (const target of targets) {
      const thicknessValueId = thicknessMap.get(target.thickness_mm);
      const lengthValueId = lengthMap.get(target.length_mm);
      const widthValueId = widthMap.get(target.width_mm);

      if (!thicknessValueId || !lengthValueId || !widthValueId) {
        console.log(
          `  MISSING option IDs for ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm -- skipping`
        );
        continue;
      }

      await sleep(DELAY_MS);

      const result = await fetchAjaxPrice(pageUrl, productId, thicknessValueId, lengthValueId, widthValueId);

      if (!result || result.priceExcVat <= 0) {
        console.log(
          `  MISSING: ${target.thickness_mm}x${target.width_mm}x${target.length_mm}mm -- no price`
        );
        continue;
      }

      const priceExcVat = result.priceExcVat;
      const priceIncVat = Math.round(priceExcVat * 1.2 * 100) / 100;

      const variant: ParsedVariant = {
        url: target.url,
        species: target.species,
        panelType: target.panel_type,
        quality: target.quality,
        thickness_mm: target.thickness_mm,
        width_mm: target.width_mm,
        length_mm: target.length_mm,
        price_inc_vat: priceIncVat,
        price_exc_vat: priceExcVat,
      };

      allProducts.push(variant);
      console.log(
        `  ${variant.species} ${variant.panelType} ${variant.thickness_mm}x${variant.width_mm}x${variant.length_mm}mm ${variant.quality} | £${priceExcVat.toFixed(2)} exc VAT`
      );
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
