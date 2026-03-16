/**
 * Mass.ee Solid Wood Panel Scraper
 *
 * Extracts solid wood panel data from mass.ee website
 * Supports multiple species: oak, ash, walnut, birch, pine, beech, etc.
 *
 * Usage:
 *   npx tsx scraper.ts                    # Scrape using DB config
 *   npx tsx scraper.ts --from-file        # Scrape products from products-to-scrape.json
 *   npx tsx scraper.ts --discover         # Discovery: find products from category pages
 *   npx tsx scraper.ts --full             # Full scan: test ALL species/dimension combos
 *   npx tsx scraper.ts --thickness 20     # Override: only 20mm panels
 *   npx tsx scraper.ts --output json      # Output as JSON
 *   npx tsx scraper.ts --file out.json    # Save to file
 *   npx tsx scraper.ts --no-config        # Ignore DB config, use fallbacks
 *   npx tsx scraper.ts --debug            # Show debug output
 *   npx tsx scraper.ts --resume           # Resume interrupted scrape from checkpoint
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import { type ScraperConfig } from './config';

// Types
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

// Species detection from URL (primary) and page title (fallback)
// URL is most reliable since page body may contain other species in navigation
function detectSpecies(url: string, pageTitle: string): string {
  const urlLower = url.toLowerCase();
  const titleLower = pageTitle.toLowerCase();

  // Check URL first (most reliable) - in order of specificity
  // Maple (Vaher)
  if (urlLower.includes('vaher')) return 'maple';

  // Walnut (Pähkel) - check before oak since "pahkel" is distinct
  if (urlLower.includes('pahkel')) return 'walnut';

  // Beech (Pöök)
  if (urlLower.includes('pook')) return 'beech';

  // Pine (Mänd)
  if (urlLower.includes('mand')) return 'pine';

  // Ash White (Hele Saar) - check before generic ash
  if (urlLower.includes('hele') && urlLower.includes('saar')) return 'ash white';

  // Ash (Saar) - check before oak
  if (urlLower.includes('saar')) return 'ash';

  // Birch (Kask)
  if (urlLower.includes('kask')) return 'birch';

  // Linden/Lime (Pärn)
  if (urlLower.includes('parn')) return 'linden';

  // Alder (Lepp)
  if (urlLower.includes('lepp')) return 'alder';

  // Cherry (Kirsipuu)
  if (urlLower.includes('kirsi')) return 'cherry';

  // Sapele (Sapeli) - tropical wood
  if (urlLower.includes('sapeli')) return 'sapele';

  // Pear (Pirn)
  if (urlLower.includes('pirn')) return 'pear';

  // Thermo-treated (Termo) - various species
  if (urlLower.includes('termo')) return 'thermo';

  // Oak (Tamm) - check last since it's most common
  if (urlLower.includes('tamm')) return 'oak';

  // Fallback: check page title (without body text which contains navigation)
  if (titleLower.includes('vaher')) return 'maple';
  if (titleLower.includes('pähkel') || titleLower.includes('pahkel')) return 'walnut';
  if (titleLower.includes('pöök') || titleLower.includes('pook')) return 'beech';
  if (titleLower.includes('mänd') || titleLower.includes('mand')) return 'pine';
  if (titleLower.includes('hele') && titleLower.includes('saar')) return 'ash white';
  if (titleLower.includes('saar')) return 'ash';
  if (titleLower.includes('kask')) return 'birch';
  if (titleLower.includes('pärn') || titleLower.includes('parn')) return 'linden';
  if (titleLower.includes('lepp')) return 'alder';
  if (titleLower.includes('kirsi')) return 'cherry';
  if (titleLower.includes('sapeli')) return 'sapele';
  if (titleLower.includes('pirn')) return 'pear';
  if (titleLower.includes('termo')) return 'thermo';
  if (titleLower.includes('tamm')) return 'oak';

  return 'unknown';
}

// Product entry from products-to-scrape.json
interface ProductEntry {
  species: string;
  processing: 'FJ' | 'FS';
  quality: string;
  thickness: number;
  width: number;
  length: number;
}

interface ScraperOptions {
  thickness?: number;
  outputFormat?: 'table' | 'json' | 'csv';
  outputFile?: string;
  debug?: boolean;
  discover?: boolean;
  fromFile?: boolean;
  resume?: boolean;
  // Filter is passed via SCRAPER_FILTER env var from portal UI
}

// Checkpoint file for resume capability
const CHECKPOINT_FILE = '.scraper-checkpoint.json';

interface CheckpointData {
  urls: string[];
  completedIndex: number;
  products: PanelProduct[];
  startedAt: string;
  lastUpdated: string;
}

function saveCheckpoint(data: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): CheckpointData | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

// Parse command line arguments
function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {
    outputFormat: 'table',
    debug: false,
    discover: false,
    fromFile: false,
    resume: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--thickness':
        options.thickness = parseInt(args[++i], 10);
        break;
      case '--output':
        options.outputFormat = args[++i] as ScraperOptions['outputFormat'];
        break;
      case '--file':
        options.outputFile = args[++i];
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--discover':
        options.discover = true;
        break;
      case '--from-file':
        options.fromFile = true;
        break;
      case '--resume':
        options.resume = true;
        break;
    }
  }

  return options;
}

// Parse dimensions from text like "20 x 1220 x 900mm" or "40 x 620 x 1450mm"
function parseDimensions(text: string): { thickness: number; width: number; length: number } | null {
  // Look for pattern like "20 x 620 x 800", "20x620x800", or "20-x-620-x-800" (URL format)
  const match = text.match(/(\d+)\s*[-]?\s*x\s*[-]?\s*(\d+)\s*[-]?\s*x\s*[-]?\s*(\d+)/i);
  if (match) {
    return {
      thickness: parseInt(match[1], 10),
      width: parseInt(match[2], 10),
      length: parseInt(match[3], 10)
    };
  }
  return null;
}

// Parse quality grade from text or URL
function parseQuality(text: string): string {
  // Check for "Rustic" first
  if (/\brustic\b/i.test(text)) return 'Rustic';
  // Check for letter grades like A/B, B/C, A-B, etc.
  const match = text.match(/\b([ABC])\/([ABC])\b/i) || text.match(/\b([ABC])\s*-\s*([ABC])\b/i);
  if (!match) return '';
  // Store without slash: A/B → AB, B/C → BC
  return (match[1] + match[2]).toUpperCase();
}

// Parse price from text
function parsePrice(text: string): number {
  // Look for price patterns like "116,54 €" or "116.54€"
  const match = text.match(/(\d+)[,.](\d+)\s*€/);
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`);
  }
  // Try without decimals
  const intMatch = text.match(/(\d+)\s*€/);
  if (intMatch) {
    return parseInt(intMatch[1], 10);
  }
  return 0;
}

// Main scraper class
class MassScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private debug: boolean = false;

  async init(debug: boolean = false): Promise<void> {
    this.debug = debug;
    console.log('Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    // Set a generous default navigation timeout
    this.page.setDefaultNavigationTimeout(60000);
  }

  /** Navigate to a URL with retries */
  private async navigateTo(url: string, retries = 3): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        console.log(`    Navigation timeout (attempt ${attempt}/${retries}), retrying...`);
        await this.page.waitForTimeout(2000);
      }
    }

    // Set Estonian locale
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'et-EE,et;q=0.9,en;q=0.8'
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Generate URLs from products-to-scrape.json file
   * Maps Timber International inventory to mass.ee URLs
   */
  generateUrlsFromFile(): string[] {
    const SPECIES_SLUGS: Record<string, string> = {
      oak: 'tamm',
      ash: 'eur--saar',  // European ash (most common) - note double dash
      'ash white': 'hele-saar',  // White ash (Hele Saar)
      birch: 'kask',
      pine: 'mand',
      beech: 'pook',
      walnut: 'pahkel',
      maple: 'vaher',
    };

    const PANEL_TYPE_SLUGS: Record<string, string> = {
      FS: 'pikk-lamell',  // Full Stave
      FJ: 'sormjatk',     // Finger Jointed
    };

    const QUALITY_SLUGS: Record<string, string> = {
      AB: 'a-b',
      'A/B': 'a-b',
      AA: 'a-a',
      'A/A': 'a-a',
      BB: 'b-b',
      'B/B': 'b-b',
      BC: 'b-c',
      'B/C': 'b-c',
      CC: 'c-c',
      'C/C': 'c-c',
      Rustic: 'rustic',
      RUSTIC: 'rustic',
    };

    // Load products from file
    const filePath = './products-to-scrape.json';
    if (!fs.existsSync(filePath)) {
      console.error(`Error: ${filePath} not found`);
      return [];
    }

    const products: ProductEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`Loaded ${products.length} products from ${filePath}`);

    const urls: string[] = [];
    const skipped: string[] = [];

    for (const product of products) {
      const speciesSlug = SPECIES_SLUGS[product.species.toLowerCase()];
      const panelTypeSlug = PANEL_TYPE_SLUGS[product.processing];
      const qualitySlug = QUALITY_SLUGS[product.quality] || 'a-b';

      if (!speciesSlug) {
        skipped.push(`Unknown species: ${product.species}`);
        continue;
      }

      if (!panelTypeSlug) {
        skipped.push(`Unknown panel type: ${product.processing}`);
        continue;
      }

      // Generate URL: https://mass.ee/liimpuit-{species}-{panel-type}-{thickness}-x-{width}-x-{length}mm-{quality}
      const url = `https://mass.ee/liimpuit-${speciesSlug}-${panelTypeSlug}-${product.thickness}-x-${product.width}-x-${product.length}mm-${qualitySlug}`;
      urls.push(url);
    }

    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length} products:`);
      const uniqueSkipped = [...new Set(skipped)];
      for (const reason of uniqueSkipped) {
        console.log(`  - ${reason}`);
      }
    }

    console.log(`Generated ${urls.length} URLs to scrape`);
    return urls;
  }

  /**
   * Scrape the actual filter values from mass.ee category pages.
   * These are the real values available on the site (thickness, width, length)
   * extracted from the filter checkbox UI.
   *
   * Returns merged values from both FS and FJ category pages.
   */
  async scrapeFilterValues(): Promise<{
    thicknesses: number[];
    widths: number[];
    lengths: number[];
  }> {
    if (!this.page) throw new Error('Browser not initialized');

    const allThicknesses = new Set<number>();
    const allWidths = new Set<number>();
    const allLengths = new Set<number>();

    const categoryPages = [
      'https://mass.ee/liimpuit-pika-lamelliga',
      'https://mass.ee/liimpuit-sormjatkatud',
    ];

    for (const url of categoryPages) {
      console.log(`\nScraping filter values from: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Extract filter blocks: each .filter-block has a label and checkbox values
      // The page has filter groups for: location, thickness (Paksus), width (Laius), length (Pikkus), tags
      // We identify them by the order: after location come thickness, width, length
      const filterGroups = await this.page.evaluate(() => {
        const groups: { label: string; values: string[] }[] = [];
        document.querySelectorAll('.filter-block').forEach((block) => {
          const labelEl = block.querySelector('.filter-block-label');
          const label = labelEl?.textContent?.trim() || '';
          const values: string[] = [];
          block.querySelectorAll('.filter-label').forEach((fl) => {
            const text = fl.textContent?.trim() || '';
            // Extract the number+mm part, e.g. "20  mm 78" → "20"
            const match = text.match(/^(\d+)\s*mm/);
            if (match) values.push(match[1]);
          });
          if (values.length > 0) {
            groups.push({ label, values });
          }
        });
        return groups;
      });

      console.log(`  Found ${filterGroups.length} filter groups with mm values`);

      // mass.ee filter groups with mm values are in order: thickness, width, length
      // Identify by typical value ranges:
      // thickness: < 100mm, width: 100-1300mm, length: > 700mm
      for (const group of filterGroups) {
        const nums = group.values.map(Number).filter((n) => n > 0);
        console.log(`  Group "${group.label}": ${nums.join(', ')}`);

        const maxVal = Math.max(...nums);
        const minVal = Math.min(...nums);

        if (maxVal <= 100) {
          // Thicknesses (12-41mm range)
          for (const n of nums) allThicknesses.add(n);
        } else if (minVal >= 100 && maxVal <= 1300) {
          // Widths (200-1220mm range)
          for (const n of nums) allWidths.add(n);
        } else if (minVal >= 700) {
          // Lengths (800-4000mm range)
          for (const n of nums) allLengths.add(n);
        }
      }
    }

    const result = {
      thicknesses: [...allThicknesses].sort((a, b) => a - b),
      widths: [...allWidths].sort((a, b) => a - b),
      lengths: [...allLengths].sort((a, b) => a - b),
    };

    console.log(`\nFilter values from mass.ee:`);
    console.log(`  Thicknesses (${result.thicknesses.length}): ${result.thicknesses.join(', ')}mm`);
    console.log(`  Widths (${result.widths.length}): ${result.widths.join(', ')}mm`);
    console.log(`  Lengths (${result.lengths.length}): ${result.lengths.join(', ')}mm`);

    return result;
  }

  /**
   * Discover ALL solid wood panel products from category pages
   * This crawls the category pages with pagination and extracts all product links
   */
  /**
   * Save discovered filter values to the scraper_config table
   */
  async saveDiscoveredFilterValues(values: {
    thicknesses: number[];
    widths: number[];
    lengths: number[];
  }): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase
      .from('scraper_config')
      .update({
        discovered_thicknesses: values.thicknesses,
        discovered_widths: values.widths,
        discovered_lengths: values.lengths,
        discovered_at: new Date().toISOString(),
      })
      .eq('source', 'mass.ee');

    if (error) {
      console.error('Failed to save discovered filter values:', error.message);
    } else {
      console.log('Saved discovered filter values to database');
    }
  }

  /**
   * Parse metadata from a product URL without visiting the page.
   * URL pattern: https://mass.ee/liimpuit-{species}-{panelType}-{thickness}-x-{width}-x-{length}mm-{quality}
   */
  private parseUrlMetadata(url: string): {
    species: string;
    panelType: string;
    quality: string;
    thickness: number | null;
    width: number | null;
    length: number | null;
  } {
    const species = detectSpecies(url, '');
    const panelType = url.includes('sormjatk') ? 'FJ' : url.includes('pikk-lamell') || url.includes('pika-lamell') ? 'FS' : '';
    const dims = parseDimensions(url);

    // Quality is the segment after "mm-", e.g. "...800mm-a-b" or "...800mm-a-b-est" → "a-b" → "A/B"
    let quality = '';
    const qualityMatch = url.match(/mm-([a-z](?:[/-][a-z])?)(?:\?|$|-[a-z]{2,})/i);
    if (qualityMatch) {
      quality = qualityMatch[1].toUpperCase().replace('-', '/');
    }
    // Also check for named quality slugs
    if (/rustic/i.test(url)) {
      quality = 'Rustic';
    } else if (/\bdiy\b/i.test(url)) {
      quality = 'DIY';
    }

    return {
      species,
      panelType,
      quality,
      thickness: dims?.thickness ?? null,
      width: dims?.width ?? null,
      length: dims?.length ?? null,
    };
  }

  /**
   * Discovery mode: find all product URLs and save metadata to database.
   * Does NOT visit individual product pages — only crawls category pages
   * and parses metadata from URLs.
   */
  /**
   * Collect all product links from the current page (with pagination + scroll).
   * Returns unique URLs found across all pages.
   */
  /**
   * Collect product URLs from the current filtered page.
   * Mass.ee shows products in merged tables — multiple size variants inside one container.
   * We extract dimensions from the page content and also collect any direct product links.
   */
  private async collectProductLinksFromPage(): Promise<string[]> {
    if (!this.page) return [];

    const allLinks = new Set<string>();
    let currentPage = 1;
    const maxPages = 50;

    while (currentPage <= maxPages) {
      // Scroll to trigger lazy loading
      for (let i = 0; i < 3; i++) {
        await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await this.page.waitForTimeout(500);
      }

      const results = await this.page.evaluate(() => {
        const links: string[] = [];

        // Collect any direct product links with dimension pattern
        document.querySelectorAll('a[href]').forEach(a => {
          const href = (a as HTMLAnchorElement).href;
          if (href && href.match(/\d+-x-\d+-x-\d+/)) {
            links.push(href);
          }
        });

        // Also extract dimension text from the page body
        // Mass.ee shows rows like "12 x 620 x 800mm" or "12x620x1800"
        const bodyText = document.body.innerText;
        const dimMatches = bodyText.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*mm/gi) || [];
        const dimensions: { thickness: number; width: number; length: number }[] = [];
        for (const m of dimMatches) {
          const parts = m.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i);
          if (parts) {
            dimensions.push({
              thickness: parseInt(parts[1], 10),
              width: parseInt(parts[2], 10),
              length: parseInt(parts[3], 10),
            });
          }
        }

        return { links, dimensions };
      });

      // Add direct links
      for (const link of results.links) allLinks.add(link);

      // For dimensions found in text, we'll return them as synthetic "dimension:" entries
      // that the caller can use to construct URLs
      for (const dim of results.dimensions) {
        allLinks.add(`dim:${dim.thickness}x${dim.width}x${dim.length}`);
      }

      if (results.links.length === 0 && results.dimensions.length === 0) break;

      // Check for next page
      const hasNextPage = await this.page.evaluate(() => {
        const paginationLinks = document.querySelectorAll('.pagination a, a[rel="next"], .page-link');
        for (const link of paginationLinks) {
          if (link.textContent?.includes('›') || link.textContent?.includes('Next') || link.getAttribute('rel') === 'next') {
            return true;
          }
        }
        return false;
      });

      if (!hasNextPage) break;

      currentPage++;
      const currentUrl = new URL(this.page.url());
      currentUrl.searchParams.set('page', String(currentPage));
      await this.page.goto(currentUrl.toString(), { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(1500);
    }

    return Array.from(allLinks);
  }

  /**
   * Get the currently visible filter values (which ones are available/not greyed out).
   * Returns the mm values for each filter group that has mm-based values.
   */
  private async getAvailableFilterValues(debugMode: boolean = false): Promise<{
    thicknesses: number[];
    widths: number[];
    lengths: number[];
  }> {
    if (!this.page) return { thicknesses: [], widths: [], lengths: [] };

    // First, debug: dump the HTML structure of filter items to understand how mass.ee marks disabled options
    if (debugMode) {
      const debugInfo = await this.page.evaluate(() => {
        const info: string[] = [];
        document.querySelectorAll('.filter-block').forEach((block) => {
          const labelEl = block.querySelector('.filter-block-label');
          const blockLabel = labelEl?.textContent?.trim() || 'UNKNOWN';
          info.push(`\nFILTER BLOCK: "${blockLabel}"`);

          block.querySelectorAll('.filter-label').forEach((fl) => {
            const text = fl.textContent?.trim() || '';
            const match = text.match(/^(\d+)\s*mm/);
            if (!match) return;

            // Walk up the DOM to find relevant parent classes
            let el: Element | null = fl;
            const classChain: string[] = [];
            for (let i = 0; i < 5 && el; i++) {
              if (el.className) classChain.push(`${el.tagName.toLowerCase()}.${el.className}`);
              el = el.parentElement;
            }

            // Check if there's a count/number after mm
            const countMatch = text.match(/(\d+)\s*mm\s*(\d*)/);
            const count = countMatch?.[2] || 'N/A';

            info.push(`  ${match[1]}mm (count: ${count}) | classes: ${classChain.join(' > ')}`);
          });
        });
        return info.join('\n');
      });
      console.log('\n=== FILTER DEBUG INFO ===');
      console.log(debugInfo);
      console.log('=== END FILTER DEBUG ===\n');
    }

    const filterGroups = await this.page.evaluate(() => {
      const groups: { label: string; values: number[] }[] = [];
      document.querySelectorAll('.filter-block').forEach((block) => {
        const labelEl = block.querySelector('.filter-block-label');
        const label = labelEl?.textContent?.trim() || '';
        const values: number[] = [];
        block.querySelectorAll('.filter-label').forEach((fl) => {
          const text = fl.textContent?.trim() || '';
          const match = text.match(/^(\d+)\s*mm/);
          if (match) {
            // Check if this filter option has a count > 0 (mass.ee shows "20 mm 78" where 78 is count)
            // If count is 0 or the item is visually hidden/disabled, skip it
            const countMatch = text.match(/(\d+)\s*mm\s+(\d+)/);
            const count = countMatch ? parseInt(countMatch[2], 10) : -1; // -1 means no count found

            // Walk up DOM to check for disabled/unavailable classes
            let el: Element | null = fl;
            let isDisabled = false;
            for (let i = 0; i < 4 && el; i++) {
              const cls = el.className?.toLowerCase() || '';
              if (cls.includes('disabled') || cls.includes('unavailable') || cls.includes('hidden') || cls.includes('inactive')) {
                isDisabled = true;
                break;
              }
              // Check computed style for display:none or opacity:0
              el = el.parentElement;
            }

            // Include if: count > 0, or count not found (assume available), and not disabled
            if (!isDisabled && count !== 0) {
              values.push(parseInt(match[1], 10));
            }
          }
        });
        if (values.length > 0) {
          groups.push({ label, values });
        }
      });
      return groups;
    });

    const thicknesses: number[] = [];
    const widths: number[] = [];
    const lengths: number[] = [];

    for (const group of filterGroups) {
      const label = group.label.toLowerCase();

      // Use Estonian filter labels from mass.ee's UI
      if (label.includes('paksus')) {
        thicknesses.push(...group.values);
      } else if (label.includes('laius')) {
        widths.push(...group.values);
      } else if (label.includes('pikkus')) {
        lengths.push(...group.values);
      }
    }

    return {
      thicknesses: [...new Set(thicknesses)].sort((a, b) => a - b),
      widths: [...new Set(widths)].sort((a, b) => a - b),
      lengths: [...new Set(lengths)].sort((a, b) => a - b),
    };
  }

  /**
   * Click a filter checkbox by its mm value within the appropriate filter block.
   * Returns true if the checkbox was found and clicked.
   */
  private async clickFilterCheckbox(value: number): Promise<boolean> {
    if (!this.page) return false;

    const clicked = await this.page.evaluate((val: number) => {
      const labels = document.querySelectorAll('.filter-label');
      for (const label of labels) {
        const text = label.textContent?.trim() || '';
        const match = text.match(/^(\d+)\s*mm/);
        if (match && parseInt(match[1], 10) === val) {
          // Click the label or its parent (which toggles the checkbox)
          const clickTarget = label.closest('label, .filter-item, .filter-option') || label;
          (clickTarget as HTMLElement).click();
          return true;
        }
      }
      return false;
    }, value);

    if (clicked) {
      // Wait for the page to update after filter click
      await this.page.waitForTimeout(1500);
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        // Timeout is OK — some filter updates are client-side only
      }
    }

    return clicked;
  }

  async discoverAllProducts(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    // Step 1: Scrape initial filter values from mass.ee
    const filterValues = await this.scrapeFilterValues();
    await this.saveDiscoveredFilterValues(filterValues);

    const allDiscoveredUrls = new Set<string>();

    // Step 2: For each category page, use filters to discover all products
    const categoryPages = [
      { url: 'https://mass.ee/liimpuit-pika-lamelliga', name: 'Full Stave (FS)' },
      // TEST: FJ disabled — uncomment when FS is verified
      // { url: 'https://mass.ee/liimpuit-sormjatkatud', name: 'Finger Jointed (FJ)' },
    ];

    for (const category of categoryPages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Discovering products: ${category.name}`);
      console.log(`${'='.repeat(60)}`);

      // Load the category page fresh
      await this.page.goto(category.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Get available thicknesses for this category
      const categoryFilters = await this.getAvailableFilterValues();
      const thicknesses = categoryFilters.thicknesses;

      console.log(`\nAvailable thicknesses: ${thicknesses.join(', ')}mm`);

      // TEST: only first 2 thicknesses — remove this limit when verified
      const testThicknesses = thicknesses.slice(0, 3);
      console.log(`  TEST: Processing ${testThicknesses.join(', ')}mm only`);

      for (const thickness of testThicknesses) {
        console.log(`\n--- Thickness: ${thickness}mm ---`);

        // Reload the category page fresh (clean filters)
        await this.page.goto(category.url, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(2000);

        // Click thickness filter
        const thicknessClicked = await this.clickFilterCheckbox(thickness);
        if (!thicknessClicked) {
          console.log(`  Could not click thickness ${thickness}mm filter, skipping`);
          continue;
        }

        // See which widths are now available
        const afterThickness = await this.getAvailableFilterValues();
        console.log(`  Available widths: ${afterThickness.widths.join(', ')}mm`);

        if (afterThickness.widths.length === 0) {
          // No width filters visible — just collect whatever products are shown
          const links = await this.collectProductLinksFromPage();
          for (const link of links) allDiscoveredUrls.add(link);
          console.log(`  Found ${links.length} products (no width filter)`);
          continue;
        }

        for (const width of afterThickness.widths) {
          // Reload with just thickness selected
          await this.page.goto(category.url, { waitUntil: 'networkidle', timeout: 30000 });
          await this.page.waitForTimeout(1500);
          await this.clickFilterCheckbox(thickness);

          // Click width filter
          const widthClicked = await this.clickFilterCheckbox(width);
          if (!widthClicked) {
            console.log(`  Could not click width ${width}mm filter, skipping`);
            continue;
          }

          // Get available lengths from filter sidebar (fast, reliable)
          const afterWidth = await this.getAvailableFilterValues();
          const availableLengths = afterWidth.lengths;

          // Get species + quality from all product links on the page
          const allLiimpuitLinks = await this.page.evaluate(() => {
            const links: string[] = [];
            document.querySelectorAll('a[href*="liimpuit-"]').forEach(a => {
              links.push((a as HTMLAnchorElement).href);
            });
            return [...new Set(links)];
          });

          const speciesFound = new Set<string>();
          const qualitiesFound = new Set<string>();

          for (const link of allLiimpuitLinks) {
            const species = detectSpecies(link, '');
            if (species !== 'unknown') speciesFound.add(species);
            const meta = this.parseUrlMetadata(link);
            if (meta.quality) qualitiesFound.add(meta.quality);
          }

          if (speciesFound.size === 0 || qualitiesFound.size === 0) {
            // Debug: dump ALL links on the page to understand why detection failed
            const allPageLinks = await this.page.evaluate(() => {
              const links: string[] = [];
              document.querySelectorAll('a[href]').forEach(a => {
                const href = (a as HTMLAnchorElement).href;
                if (href && !href.startsWith('javascript') && !href.includes('#')) links.push(href);
              });
              return [...new Set(links)];
            });
            console.log(`  ${thickness}x${width}mm: ⚠ Could not detect species (${speciesFound.size}) or qualities (${qualitiesFound.size})`);
            console.log(`    DEBUG: ${allPageLinks.length} total links on page`);
            // Show links that might be product links (contain dimensions or product keywords)
            const productishLinks = allPageLinks.filter(l => l.match(/\d+-x-\d+/) || l.includes('pook') || l.includes('beech') || l.includes('lamell'));
            console.log(`    DEBUG product-ish links: ${productishLinks.map(l => l.replace('https://mass.ee/', '')).join(', ')}`);
            continue;
          }

          // Construct URLs for each length × species × quality
          const SPECIES_SLUGS: Record<string, string> = {
            oak: 'tamm', ash: 'eur--saar', 'ash white': 'hele-saar', birch: 'kask', pine: 'mand',
            beech: 'pook', walnut: 'pahkel', maple: 'vaher', linden: 'parn',
            alder: 'lepp', cherry: 'kirsi', sapele: 'sapeli', pear: 'pirn', thermo: 'termo',
          };
          const QUALITY_SLUGS: Record<string, string> = {
            'AB': 'a-b', 'AA': 'a-a', 'BB': 'b-b', 'BC': 'b-c', 'CC': 'c-c',
            'A/B': 'a-b', 'A/A': 'a-a', 'B/B': 'b-b', 'B/C': 'b-c', 'C/C': 'c-c',
            'Rustic': 'rustic', 'DIY': 'diy',
          };
          const ptSlug = category.url.includes('sormjatk') ? 'sormjatk' : 'pikk-lamell';

          // Construct candidate URLs
          const candidateUrls: string[] = [];
          for (const species of speciesFound) {
            const speciesSlug = SPECIES_SLUGS[species];
            if (!speciesSlug) continue;
            for (const quality of qualitiesFound) {
              const qualitySlug = QUALITY_SLUGS[quality];
              if (!qualitySlug) continue;
              for (const length of availableLengths) {
                const url = `https://mass.ee/liimpuit-${speciesSlug}-${ptSlug}-${thickness}-x-${width}-x-${length}mm-${qualitySlug}`;
                if (!allDiscoveredUrls.has(url)) {
                  candidateUrls.push(url);
                }
              }
            }
          }

          // Verify candidates with HEAD requests (5 in parallel)
          let verifiedCount = 0;
          for (let i = 0; i < candidateUrls.length; i += 5) {
            const batch = candidateUrls.slice(i, i + 5);
            const results = await Promise.all(
              batch.map(async (url) => {
                try {
                  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
                  return { url, exists: response.status === 200 };
                } catch {
                  return { url, exists: false };
                }
              })
            );
            for (const { url, exists } of results) {
              if (exists) {
                allDiscoveredUrls.add(url);
                verifiedCount++;
              }
            }
          }

          console.log(`  ${thickness}x${width}mm: ${availableLengths.length} lengths [${availableLengths.join(', ')}], ${[...speciesFound].join('+')} species, ${[...qualitiesFound].join('+')} qualities → ${verifiedCount}/${candidateUrls.length} verified (total: ${allDiscoveredUrls.size})`);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total verified product URLs: ${allDiscoveredUrls.size}`);
    console.log(`${'='.repeat(60)}`);

    // Parse metadata from verified URLs and save to database
    console.log('\nParsing metadata from verified URLs...');
    const urlRecords = [...allDiscoveredUrls].map((url) => {
      const meta = this.parseUrlMetadata(url);
      return {
        source: 'mass.ee',
        url,
        species: meta.species || null,
        panel_type: meta.panelType || null,
        thickness_mm: meta.thickness,
        width_mm: meta.width,
        length_mm: meta.length,
        quality: meta.quality || null,
        is_active: true,
        last_checked_at: new Date().toISOString(),
      };
    });

    const finalSpecies = [...new Set(urlRecords.map((r) => r.species).filter(Boolean))].sort();
    const finalPanelTypes = [...new Set(urlRecords.map((r) => r.panel_type).filter(Boolean))].sort();
    const finalQualities = [...new Set(urlRecords.map((r) => r.quality).filter(Boolean))].sort();
    console.log(`  Species: ${finalSpecies.join(', ')}`);
    console.log(`  Panel types: ${finalPanelTypes.join(', ')}`);
    console.log(`  Qualities: ${finalQualities.join(', ')}`);

    // Save to database
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot save URLs');
      return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deactivate URLs no longer found on the site
    const { data: existingUrls } = await supabase
      .from('scraper_product_urls')
      .select('url')
      .eq('source', 'mass.ee')
      .eq('is_active', true);

    const discoveredUrlSet = new Set([...allDiscoveredUrls]);
    const urlsToDeactivate = (existingUrls || [])
      .map((r: { url: string }) => r.url)
      .filter((url: string) => !discoveredUrlSet.has(url));

    if (urlsToDeactivate.length > 0) {
      console.log(`\nDeactivating ${urlsToDeactivate.length} URLs no longer found on the site`);
      await supabase
        .from('scraper_product_urls')
        .update({ is_active: false })
        .eq('source', 'mass.ee')
        .in('url', urlsToDeactivate);
    }

    // Upsert discovered URLs (in batches)
    const batchSize = 100;
    let totalSaved = 0;
    for (let i = 0; i < urlRecords.length; i += batchSize) {
      const batch = urlRecords.slice(i, i + batchSize);
      const { data: urlData, error: urlError } = await supabase
        .from('scraper_product_urls')
        .upsert(batch, { onConflict: 'source,url' })
        .select('id');

      if (urlError) {
        console.error(`Failed to save batch ${i / batchSize + 1}:`, urlError.message);
      } else {
        totalSaved += urlData?.length || 0;
      }
    }

    console.log(`\nSaved ${totalSaved} product URLs to database (discovered: ${urlRecords.length}, deactivated: ${urlsToDeactivate.length})`);
    console.log('\nDiscovery complete!');
  }

  /**
   * EXPERIMENTAL: Discovery by reading the page's product group structure.
   * Instead of using filter sidebar, reads the product divisions directly:
   *   Category page → product groups (species/quality) → thickness sub-groups → individual product links
   */
  async discoverByPageStructure(): Promise<string[]> {
    if (!this.page) throw new Error('Browser not initialized');

    const allDiscoveredUrls = new Set<string>();

    const categoryPages = [
      { url: 'https://mass.ee/liimpuit-pika-lamelliga', name: 'Full Stave (FS)', panelType: 'FS' },
      { url: 'https://mass.ee/liimpuit-sormjatkatud', name: 'Finger Jointed (FJ)', panelType: 'FJ' },
    ];

    for (const category of categoryPages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Discovering: ${category.name}`);
      console.log(`${'='.repeat(60)}`);

      await this.navigateTo(category.url);
      await this.page.waitForTimeout(2000);

      // Step 1: Find product group cards on the category page
      // Each group is an <a> inside div.product-data with an H2 heading
      const groups = await this.page.evaluate(() => {
        const result: { heading: string; href: string }[] = [];
        document.querySelectorAll('.product-data').forEach(pd => {
          const h2 = pd.querySelector('h2')?.textContent?.trim() || '';
          const parentA = pd.parentElement;
          if (parentA?.tagName === 'A') {
            const href = (parentA as HTMLAnchorElement).href;
            if (h2 && href) {
              result.push({ heading: h2, href });
            }
          }
        });
        return result;
      });

      console.log(`\nFound ${groups.length} product groups on category page`);

      // Step 2: Visit each group page and collect all product links
      for (const group of groups) {
        console.log(`\n  Visiting: "${group.heading}"`);
        await this.navigateTo(group.href);
        await this.page.waitForTimeout(1500);

        // Scroll to load all content
        for (let i = 0; i < 5; i++) {
          await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await this.page.waitForTimeout(300);
        }

        // Collect product links only from .product-data containers (not related products / footer)
        const productLinks = await this.page.evaluate(() => {
          const links: string[] = [];
          document.querySelectorAll('.product-data a[href]').forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (href.match(/\d+-x-\d+-x-\d+/)) {
              const clean = href.split('?')[0];
              links.push(clean);
            }
          });
          // Fallback: if no links found in .product-data, try main content area
          if (links.length === 0) {
            document.querySelectorAll('.products a[href], .product-list a[href], main a[href]').forEach(a => {
              const href = (a as HTMLAnchorElement).href;
              if (href.match(/\d+-x-\d+-x-\d+/) && href.includes('liimpuit')) {
                const clean = href.split('?')[0];
                links.push(clean);
              }
            });
          }
          return [...new Set(links)];
        });

        // Add to discovered URLs
        let newCount = 0;
        const thicknesses = new Set<number>();
        for (const link of productLinks) {
          const dims = parseDimensions(link);
          if (dims) thicknesses.add(dims.thickness);
          if (!allDiscoveredUrls.has(link)) {
            allDiscoveredUrls.add(link);
            newCount++;
          }
        }

        const sortedThicknesses = [...thicknesses].sort((a, b) => a - b);
        console.log(`    ${productLinks.length} products, thicknesses: [${sortedThicknesses.join(', ')}]mm → ${newCount} new URLs (total: ${allDiscoveredUrls.size})`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total product URLs discovered: ${allDiscoveredUrls.size}`);
    console.log(`${'='.repeat(60)}`);

    // Save to database
    console.log('\nParsing metadata and saving...');
    const urlRecords = [...allDiscoveredUrls].map((url) => {
      const meta = this.parseUrlMetadata(url);
      return {
        source: 'mass.ee',
        url,
        species: meta.species || null,
        panel_type: meta.panelType || null,
        thickness_mm: meta.thickness,
        width_mm: meta.width,
        length_mm: meta.length,
        quality: meta.quality || null,
        is_active: true,
        last_checked_at: new Date().toISOString(),
      };
    });

    const finalSpecies = [...new Set(urlRecords.map((r) => r.species).filter(Boolean))].sort();
    const finalQualities = [...new Set(urlRecords.map((r) => r.quality).filter(Boolean))].sort();
    console.log(`  Species: ${finalSpecies.join(', ')}`);
    console.log(`  Qualities: ${finalQualities.join(', ')}`);

    // Save to DB
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot save URLs to DB');
      console.log('Continuing with discovered URLs without saving...');
      return [...allDiscoveredUrls];
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deactivate URLs no longer found
    const { data: existingUrls } = await supabase
      .from('scraper_product_urls')
      .select('url')
      .eq('source', 'mass.ee')
      .eq('is_active', true);

    const discoveredUrlSet = new Set([...allDiscoveredUrls]);
    const urlsToDeactivate = (existingUrls || [])
      .map((r: { url: string }) => r.url)
      .filter((url: string) => !discoveredUrlSet.has(url));

    if (urlsToDeactivate.length > 0) {
      console.log(`Deactivating ${urlsToDeactivate.length} URLs no longer found`);
      await supabase
        .from('scraper_product_urls')
        .update({ is_active: false })
        .eq('source', 'mass.ee')
        .in('url', urlsToDeactivate);
    }

    // Upsert
    const batchSize = 100;
    let totalSaved = 0;
    for (let i = 0; i < urlRecords.length; i += batchSize) {
      const batch = urlRecords.slice(i, i + batchSize);
      const { data: urlData, error: urlError } = await supabase
        .from('scraper_product_urls')
        .upsert(batch, { onConflict: 'source,url' })
        .select('id');

      if (urlError) {
        console.error(`Failed to save batch:`, urlError.message);
      } else {
        totalSaved += urlData?.length || 0;
      }
    }

    console.log(`Saved ${totalSaved} product URLs to database`);
    console.log('\nDiscovery complete!');

    return [...allDiscoveredUrls];
  }

  async scrapeProductPage(url: string): Promise<PanelProduct | null> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.navigateTo(url);
      await this.page.waitForTimeout(1000);

      // Get page content
      const pageTitle = await this.page.title();
      const bodyText: string = await this.page.evaluate('document.body.innerText') as string;

      console.log(`  Title: ${pageTitle}`);

      if (this.debug) {
        console.log(`  Body preview: ${bodyText.substring(0, 500)}`);
      }

      // Extract dimensions from URL first (most reliable), then page title, then body
      const dims = parseDimensions(url) || parseDimensions(pageTitle) || parseDimensions(bodyText);

      if (!dims) {
        console.log(`  No dimensions found, skipping`);
        return null;
      }

      // Check if we're on a valid product page (not homepage)
      // Look for product indicators in the page HTML content
      const pageHtml: string = await this.page.content();
      const hasProductIndicators = pageHtml.includes('merged-product-price') ||
                                    pageHtml.includes('€ / tk') ||
                                    pageHtml.includes('Hind:') ||
                                    pageTitle.toLowerCase().includes('liimpuit');

      if (!hasProductIndicators) {
        console.log(`  Not a product page (no price indicators), skipping`);
        return null;
      }

      // Detect species from URL and title (not body, which contains navigation with other species)
      const species = detectSpecies(url, pageTitle);
      if (species === 'unknown') {
        console.log(`  Unknown species, skipping`);
        return null;
      }

      const quality = parseQuality(pageTitle) || parseQuality(bodyText);

      // Extract prices and stock by finding the specific product row
      const productData = await this.page.evaluate(`
        (function() {
          var result = {
            pricePerPiece: 0,
            pricePerM2: 0,
            tallinn: 0,
            tartu: 0
          };

          // Target dimensions passed from Node.js (extracted from URL)
          var targetThickness = '${dims.thickness}';
          var targetWidth = '${dims.width}';
          var targetLength = '${dims.length}';
          var dimRegex = new RegExp(targetThickness + '\\\\s*x\\\\s*' + targetWidth + '\\\\s*x\\\\s*' + targetLength, 'i');

          // Find all product containers
          var containers = document.querySelectorAll('.merged_product2, [class*="merged-product-data"], .product-item, tr[class*="product"]');

          for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var text = container.innerText || '';

            // Check if this product matches our target dimensions
            if (!dimRegex.test(text)) continue;

            // Found matching product! Extract price from text
            // Pattern: "Hind: 99,84 € / tk" or "Hind: 99,84 €"
            var priceMatch = text.match(/Hind[:\\s]*(\\d+)[,\\.](\\d{2})\\s*€/i);
            if (priceMatch) {
              result.pricePerPiece = parseFloat(priceMatch[1] + '.' + priceMatch[2]);
            }

            // Extract m² price: "Hind m² kohta: 102,12 €"
            var m2Match = text.match(/m²\\s*kohta[:\\s]*(\\d+)[,\\.](\\d{2})\\s*€/i);
            if (m2Match) {
              result.pricePerM2 = parseFloat(m2Match[1] + '.' + m2Match[2]);
            }

            // Extract stock - look for "Tallinn: X tk" or "Tallinn X" patterns
            var tallinnMatch = text.match(/Tallinn[:\\s]*(\\d+)/i);
            if (tallinnMatch) {
              result.tallinn = parseInt(tallinnMatch[1]);
            }

            var tartuMatch = text.match(/Tartu[:\\s]*(\\d+)/i);
            if (tartuMatch) {
              result.tartu = parseInt(tartuMatch[1]);
            }

            // Also check for stock in child elements with stock-related classes
            var stockEls = container.querySelectorAll('[class*="stock"], [class*="laos"], [class*="warehouse"]');
            for (var j = 0; j < stockEls.length; j++) {
              var stockText = stockEls[j].innerText || '';
              if (result.tallinn === 0) {
                var tll = stockText.match(/Tallinn[:\\s]*(\\d+)/i);
                if (tll) result.tallinn = parseInt(tll[1]);
              }
              if (result.tartu === 0) {
                var trt = stockText.match(/Tartu[:\\s]*(\\d+)/i);
                if (trt) result.tartu = parseInt(trt[1]);
              }
            }

            break; // Found our product
          }

          // Fallback: search entire page HTML for the price
          if (result.pricePerPiece === 0) {
            var html = document.body.innerHTML || '';
            var dimStr = targetThickness + '\\\\s*x\\\\s*' + targetWidth + '\\\\s*x\\\\s*' + targetLength;

            // Find text context around our dimensions
            var fullMatch = html.match(new RegExp(dimStr + '[\\\\s\\\\S]{0,500}?Hind[:\\\\s]*(\\\\d+)[,\\\\.](\\\\d{2})', 'i'));
            if (fullMatch) {
              result.pricePerPiece = parseFloat(fullMatch[1] + '.' + fullMatch[2]);
            }
          }

          return result;
        })()
      `) as { pricePerPiece: number; pricePerM2: number; tallinn: number; tartu: number };

      // Remove 24% VAT from prices (mass.ee shows prices with VAT)
      const pricePerPiece = Math.round((productData.pricePerPiece / 1.24) * 100) / 100;
      const pricePerM2 = Math.round((productData.pricePerM2 / 1.24) * 100) / 100;
      const stockData = { tallinn: productData.tallinn, tartu: productData.tartu };

      console.log(`  ${species} ${dims.thickness}x${dims.width}x${dims.length}mm ${quality || '-'} | €${pricePerM2}/m² excl VAT | Stock: TLL ${stockData.tallinn}, TRT ${stockData.tartu}`);

      return {
        name: pageTitle.replace(' - MASS', '').replace(' | MASS', '').trim(),
        productCode: '',
        species: species,
        thickness: dims.thickness,
        width: dims.width,
        length: dims.length,
        quality: quality,
        pricePerPiece: pricePerPiece,
        pricePerM2: pricePerM2,
        stockTallinn: stockData.tallinn,
        stockTartu: stockData.tartu,
        totalStock: stockData.tallinn + stockData.tartu,
        url: url,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`  Error: ${error}`);
      return null;
    }
  }

  async scrapeAllOakPanels(options: ScraperOptions, config: ScraperConfig | null): Promise<PanelProduct[]> {
    let allProducts: PanelProduct[] = [];
    let urls: string[] = [];
    let startIndex = 0;

    // Check for resume
    if (options.resume) {
      const checkpoint = loadCheckpoint();
      if (checkpoint) {
        urls = checkpoint.urls;
        allProducts = checkpoint.products;
        startIndex = checkpoint.completedIndex + 1;
        console.log(`\n--- RESUMING from checkpoint ---`);
        console.log(`  Started: ${checkpoint.startedAt}`);
        console.log(`  Last updated: ${checkpoint.lastUpdated}`);
        console.log(`  Completed: ${checkpoint.completedIndex + 1}/${urls.length} URLs`);
        console.log(`  Products found so far: ${allProducts.length}`);
        console.log(`  Resuming from URL #${startIndex + 1}...`);
      } else {
        console.log('\nNo checkpoint found. Starting fresh scrape.');
        options.resume = false;
      }
    }

    // Step 1: Get URLs (skip if resuming)
    if (!options.resume) {
      if (options.fromFile) {
        console.log('\n--- FROM-FILE MODE: Scraping products from products-to-scrape.json ---');
        urls = this.generateUrlsFromFile();
      } else if (options.discover) {
        // Discovery only — find URLs, save to DB, stop
        console.log('\n--- DISCOVERY MODE: Finding product URLs from page structure ---');
        await this.discoverByPageStructure();
        console.log('\nDiscovery complete. URLs saved to database.');
        return [];
      } else {
        // Default: load saved URLs from database, filtered by UI selections
        console.log('\n--- Loading saved product URLs from database ---');
        const { loadSavedUrls } = await import('./config');

        // Parse filter from SCRAPER_FILTER env var (passed from portal UI)
        let filter = undefined;
        const filterJson = process.env.SCRAPER_FILTER;
        console.log('SCRAPER_FILTER env:', filterJson || '(not set)');
        if (filterJson) {
          try {
            filter = JSON.parse(filterJson);
            console.log('Applying filters from UI selections...');
          } catch {
            console.error('Failed to parse filter JSON, loading all URLs');
          }
        }

        urls = await loadSavedUrls('mass.ee', filter);
        if (urls.length === 0) {
          console.log('No saved URLs found matching filters. Run discovery or adjust selections.');
          return [];
        }
        console.log(`Loaded ${urls.length} URLs to scrape${filter ? ' (filtered)' : ''}`);
      }

      // Clear any old checkpoint and save initial state
      clearCheckpoint();
    }

    // Step 2: Scrape each URL with rate limiting and checkpointing
    const totalUrls = urls.length;
    console.log(`\n--- Processing ${totalUrls} URLs (starting from #${startIndex + 1}) ---`);

    for (let i = startIndex; i < urls.length; i++) {
      const url = urls[i];

      // Filter by thickness if specified via CLI
      if (options.thickness) {
        const urlDims = parseDimensions(url);
        if (urlDims && urlDims.thickness !== options.thickness) {
          // Save checkpoint even for skipped URLs
          saveCheckpoint({ urls, completedIndex: i, products: allProducts, startedAt: allProducts.length > 0 ? allProducts[0].scrapedAt : new Date().toISOString(), lastUpdated: new Date().toISOString() });
          continue;
        }
      }

      // Log with URL number
      console.log(`\n[${i + 1}/${totalUrls}] Scraping: ${url}`);
      const product = await this.scrapeProductPage(url);
      if (product) {
        if (options.thickness && product.thickness !== options.thickness) {
          // Save checkpoint
          saveCheckpoint({ urls, completedIndex: i, products: allProducts, startedAt: allProducts.length > 0 ? allProducts[0].scrapedAt : new Date().toISOString(), lastUpdated: new Date().toISOString() });
          continue;
        }
        allProducts.push(product);
      }

      // Save checkpoint after each URL
      saveCheckpoint({
        urls,
        completedIndex: i,
        products: allProducts,
        startedAt: allProducts.length > 0 ? allProducts[0].scrapedAt : new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      // Rate limiting: 2s between requests, 10s pause every 25 requests
      const processed = i - startIndex + 1;
      if (processed % 25 === 0) {
        console.log(`\n  Progress: ${i + 1}/${totalUrls} URLs processed, ${allProducts.length} products found. Pausing 10s...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // All done — clear checkpoint
    clearCheckpoint();
    console.log(`\nScraping complete. Checkpoint cleared.`);

    return allProducts;
  }
}

// Output formatters
function formatAsTable(products: PanelProduct[]): void {
  if (products.length === 0) {
    console.log('No products found.');
    return;
  }

  console.log('\n' + '='.repeat(145));
  console.log('| Species  | Thickness | Width  | Length | Quality | Price/pc  | Price/m² | Tallinn | Tartu | Total | Name');
  console.log('|' + '-'.repeat(143) + '|');

  for (const p of products) {
    console.log(
      `| ${p.species.padEnd(8)} ` +
      `| ${String(p.thickness).padStart(6)}mm ` +
      `| ${String(p.width).padStart(4)}mm ` +
      `| ${String(p.length).padStart(4)}mm ` +
      `| ${(p.quality || 'N/A').padEnd(7)} ` +
      `| €${p.pricePerPiece.toFixed(2).padStart(7)} ` +
      `| €${p.pricePerM2.toFixed(2).padStart(6)} ` +
      `| ${String(p.stockTallinn).padStart(7)} ` +
      `| ${String(p.stockTartu).padStart(5)} ` +
      `| ${String(p.totalStock).padStart(5)} ` +
      `| ${p.name.substring(0, 35)}`
    );
  }
  console.log('='.repeat(145));
}

function formatAsCsv(products: PanelProduct[]): string {
  const headers = [
    'name', 'species', 'thickness_mm', 'width_mm', 'length_mm', 'quality',
    'price_eur', 'price_m2_eur', 'stock_tallinn', 'stock_tartu', 'total_stock', 'url'
  ];

  const rows = products.map(p => [
    `"${p.name.replace(/"/g, '""')}"`,
    p.species,
    p.thickness, p.width, p.length, p.quality,
    p.pricePerPiece, p.pricePerM2,
    p.stockTallinn, p.stockTartu, p.totalStock,
    p.url
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

// Main execution
async function main() {
  const options = parseArgs();
  const scraper = new MassScraper();

  console.log('='.repeat(60));
  console.log('Mass.ee Solid Wood Panel Scraper');
  console.log('='.repeat(60));

  if (options.resume) {
    console.log('Mode: RESUME (continuing interrupted scrape from checkpoint)');
  } else if (options.discover) {
    console.log('Mode: DISCOVERY (find product URLs, save to database)');
  } else if (options.fromFile) {
    console.log('Mode: FROM-FILE (scraping products from products-to-scrape.json)');
  } else {
    console.log('Mode: SCRAPE (using saved URLs from database)');
  }

  const config: ScraperConfig | null = null;

  if (options.thickness) {
    console.log(`CLI Override: ${options.thickness}mm thickness only`);
  }
  if (options.debug) {
    console.log('Debug mode: ON');
  }
  console.log('='.repeat(60));

  try {
    await scraper.init(options.debug);
    const products = await scraper.scrapeAllOakPanels(options, config);

    console.log('\n' + '='.repeat(60));
    console.log(`Total products found: ${products.length}`);
    console.log('='.repeat(60));

    // Save results
    if (options.outputFile) {
      const json = JSON.stringify(products, null, 2);
      fs.writeFileSync(options.outputFile, json);
      console.log(`Saved to: ${options.outputFile}`);
    }

    // Format output for display
    switch (options.outputFormat) {
      case 'json':
        if (!options.outputFile) {
          console.log(JSON.stringify(products, null, 2));
        }
        break;
      case 'csv':
        const csv = formatAsCsv(products);
        console.log(csv);
        break;
      default:
        formatAsTable(products);
    }

    // Summary
    if (products.length > 0) {
      const totalStock = products.reduce((sum, p) => sum + p.totalStock, 0);
      console.log('\nSummary:');
      console.log(`  Products: ${products.length}`);
      console.log(`  Total stock: ${totalStock} pieces`);

      // Species breakdown
      const speciesCounts: Record<string, number> = {};
      for (const p of products) {
        speciesCounts[p.species] = (speciesCounts[p.species] || 0) + 1;
      }
      const speciesStr = Object.entries(speciesCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([s, c]) => `${s}: ${c}`)
        .join(', ');
      console.log(`  Species: ${speciesStr}`);

      const thicknesses = [...new Set(products.map(p => p.thickness))].sort((a, b) => a - b);
      console.log(`  Thicknesses: ${thicknesses.map(t => t + 'mm').join(', ')}`);

      const avgPrice = products.reduce((sum, p) => sum + p.pricePerPiece, 0) / products.length;
      console.log(`  Average price: €${avgPrice.toFixed(2)}/piece`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

main();
