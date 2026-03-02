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
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import { loadConfig, generateUrls, matchesConfig, type ScraperConfig } from './config';

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
  noConfig?: boolean; // Skip loading config from database
  discover?: boolean; // Use discovery mode to find products from category pages
  full?: boolean;     // Full scan mode - test all species/dimension combinations
  fromFile?: boolean; // Scrape products from products-to-scrape.json
}

// Parse command line arguments
function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {
    outputFormat: 'table',
    debug: false,
    noConfig: false,
    discover: false,
    full: false,
    fromFile: false
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
      case '--no-config':
        options.noConfig = true;
        break;
      case '--discover':
        options.discover = true;
        break;
      case '--full':
        options.full = true;
        options.discover = true; // Full scan implies discovery
        break;
      case '--from-file':
        options.fromFile = true;
        break;
    }
  }

  return options;
}

// Parse dimensions from text like "20 x 1220 x 900mm" or "40 x 620 x 1450mm"
function parseDimensions(text: string): { thickness: number; width: number; length: number } | null {
  // Look for pattern like "20 x 620 x 800" or "20x620x800"
  const match = text.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i);
  if (match) {
    return {
      thickness: parseInt(match[1], 10),
      width: parseInt(match[2], 10),
      length: parseInt(match[3], 10)
    };
  }
  return null;
}

// Parse quality grade from text
function parseQuality(text: string): string {
  const match = text.match(/\b([ABC])\/([ABC])\b/i) || text.match(/\b([ABC])\s*-\s*([ABC])\b/i);
  return match ? match[0].toUpperCase().replace('-', '/') : '';
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
      BC: 'b-c',
      'B/C': 'b-c',
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
   * Generate focused list of URLs for all species with common dimensions
   * Based on known URL patterns from mass.ee
   */
  generateComprehensiveUrls(): string[] {
    const urls: string[] = [];

    // Species with their Estonian slugs (most common ones)
    const species = ['tamm', 'saar', 'hele-saar', 'kask', 'mand', 'pook', 'pahkel', 'vaher'];

    // Panel types
    const panelTypes = ['pikk-lamell', 'sormjatk'];

    // Focus on most common thicknesses
    const thicknesses = [18, 19, 20, 26, 27, 30, 40];

    // Focus on most common widths
    const widths = [400, 600, 620, 1000, 1200, 1220];

    // Focus on most common lengths
    const lengths = [800, 900, 1000, 1200, 1500, 2000, 2100, 2500, 3000, 4000, 4200];

    console.log('Generating focused URL list...');
    console.log(`  Species: ${species.length}`);
    console.log(`  Panel types: ${panelTypes.length}`);
    console.log(`  Thicknesses: ${thicknesses.length}`);
    console.log(`  Widths: ${widths.length}`);
    console.log(`  Lengths: ${lengths.length}`);

    // Generate URLs for focused combinations
    for (const speciesSlug of species) {
      for (const panelType of panelTypes) {
        for (const thickness of thicknesses) {
          for (const width of widths) {
            for (const length of lengths) {
              // Only include A/B quality (most common)
              const url = `https://mass.ee/liimpuit-${speciesSlug}-${panelType}-${thickness}-x-${width}-x-${length}mm-a-b`;
              urls.push(url);
            }
          }
        }
      }
    }

    console.log(`  Generated ${urls.length} URLs to test`);
    return urls;
  }

  /**
   * Discover ALL solid wood panel products from category pages
   * This crawls the category pages with pagination and extracts all product links
   */
  async discoverAllProducts(): Promise<string[]> {
    if (!this.page) throw new Error('Browser not initialized');

    const allUrls: Set<string> = new Set();

    // Category pages to crawl
    const categoryPages = [
      'https://mass.ee/liimpuit-pika-lamelliga',  // Full stave panels
      'https://mass.ee/liimpuit-sormjatkatud',     // Finger jointed panels
    ];

    for (const categoryUrl of categoryPages) {
      console.log(`\nDiscovering products from: ${categoryUrl}`);

      let currentPage = 1;
      const maxPages = 50; // Safety limit

      while (currentPage <= maxPages) {
        try {
          // Build URL with pagination
          const pageUrl = currentPage === 1
            ? categoryUrl
            : `${categoryUrl}?page=${currentPage}`;

          await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await this.page.waitForTimeout(2000);

          // Scroll to trigger lazy loading
          for (let i = 0; i < 3; i++) {
            await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await this.page.waitForTimeout(500);
          }

          // Find all product links
          const links = await this.page.evaluate(() => {
            const urls: string[] = [];
            const anchors = document.querySelectorAll('a[href*="liimpuit-"]');

            for (const anchor of anchors) {
              const href = (anchor as HTMLAnchorElement).href;
              // Filter for product pages (contain dimensions pattern like "20-x-620-x-800")
              if (href && href.match(/\d+-x-\d+-x-\d+/)) {
                urls.push(href);
              }
            }

            return urls;
          });

          if (links.length === 0) {
            // No more products, stop pagination
            break;
          }

          const prevCount = allUrls.size;
          for (const link of links) {
            allUrls.add(link);
          }
          const newCount = allUrls.size - prevCount;

          if (currentPage === 1) {
            console.log(`  Found ${links.length} product links`);
          } else {
            console.log(`  Page ${currentPage}: Found ${links.length} product links`);
          }

          // If no new unique URLs were added, we've likely reached the end
          if (newCount === 0 && currentPage > 1) {
            break;
          }

          currentPage++;

          // Be respectful - small delay between pages
          await this.page.waitForTimeout(500);

        } catch (error) {
          console.error(`  Error on page ${currentPage}: ${error}`);
          break;
        }
      }
    }

    const uniqueUrls = Array.from(allUrls);
    console.log(`\nTotal unique product URLs discovered: ${uniqueUrls.length}`);

    return uniqueUrls;
  }

  /**
   * Full scan mode - generate comprehensive URLs for all species/dimensions
   */
  async fullScan(): Promise<string[]> {
    // First discover from category pages
    const discovered = await this.discoverAllProducts();

    // Then add comprehensive URL generation
    console.log('\nGenerating comprehensive URLs for full scan...');
    const comprehensive = this.generateComprehensiveUrls();

    // Merge (discovered first as they're known to exist)
    const merged = [...new Set([...discovered, ...comprehensive])];
    console.log(`\nTotal URLs for full scan: ${merged.length} (${discovered.length} discovered + ${comprehensive.length} generated)`);

    return merged;
  }

  async discoverOakPanelUrls(): Promise<string[]> {
    if (!this.page) throw new Error('Browser not initialized');

    const urls: string[] = [];

    // Go to the oak panel category page and find product links
    try {
      console.log(`\nNavigating to oak panel category...`);
      await this.page.goto('https://mass.ee/liimpuit-pika-lamelliga', { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Look for product links that contain dimensions in the URL
      const links = await this.page.evaluate(`
        (function() {
          var links = [];
          var anchors = document.querySelectorAll('a');
          for (var i = 0; i < anchors.length; i++) {
            var href = anchors[i].href;
            // Look for URLs with dimension patterns like "20-x-620-x-800" or containing "tamm" with dimensions
            if (href && href.includes('mass.ee') && !href.includes('#')) {
              // Check for dimension pattern in URL
              if (href.match(/\\d+[-x]+\\d+[-x]+\\d+/i) ||
                  (href.includes('tamm') && href.match(/\\d+mm/i))) {
                links.push(href);
              }
            }
          }
          return links;
        })()
      `);

      if (Array.isArray(links) && links.length > 0) {
        console.log(`  Found ${links.length} product links with dimensions`);
        for (const link of links) {
          if (!urls.includes(link)) {
            urls.push(link);
          }
        }
      }

      // Also look for product cards/tiles with links
      const productCards = await this.page.evaluate(`
        (function() {
          var links = [];
          // Look for common product card patterns
          var cards = document.querySelectorAll('.product-card a, .product-item a, .product a, [class*="product"] a');
          for (var i = 0; i < cards.length; i++) {
            var href = cards[i].href;
            if (href && href.includes('mass.ee') && !href.includes('#')) {
              links.push(href);
            }
          }
          return links;
        })()
      `);

      if (Array.isArray(productCards) && productCards.length > 0) {
        console.log(`  Found ${productCards.length} product card links`);
        for (const link of productCards) {
          if (!urls.includes(link)) {
            urls.push(link);
          }
        }
      }

      // Check for "tamm" specific pages
      console.log(`\nNavigating to oak (tamm) category...`);
      await this.page.goto('https://mass.ee/tamm', { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Find product links on this page
      const oakLinks = await this.page.evaluate(`
        (function() {
          var links = [];
          var anchors = document.querySelectorAll('a');
          for (var i = 0; i < anchors.length; i++) {
            var href = anchors[i].href;
            var text = (anchors[i].innerText || '').toLowerCase();
            if (href && href.includes('mass.ee') && !href.includes('#')) {
              // Look for dimension patterns or "liimpuit" products
              if (href.match(/\\d+[-x]+\\d+[-x]+\\d+/i) ||
                  (href.includes('liimpuit') && href.includes('tamm'))) {
                links.push(href);
              }
            }
          }
          return links;
        })()
      `);

      if (Array.isArray(oakLinks) && oakLinks.length > 0) {
        console.log(`  Found ${oakLinks.length} oak product links`);
        for (const link of oakLinks) {
          if (!urls.includes(link)) {
            urls.push(link);
          }
        }
      }

    } catch (error) {
      console.error(`  Error discovering URLs: ${error}`);
    }

    // Filter out category/navigation links and keep only OAK (TAMM) product pages
    const productUrls = urls.filter(url => {
      // Exclude category pages and navigation
      const excludePatterns = [
        '/liimpuit-sormjatkatud',
        '/liimpuit-pika-lamelliga',
        '/liimpuit-detailid',
        '/liimpuitplaadid',
        '/tammest-liimpuitplaadid',
        '/tooted?',
        '/otsing',
        '/blogi',
        '/kontakt',
      ];
      if (excludePatterns.some(pattern => url.includes(pattern))) {
        return false;
      }
      // Only keep URLs that contain "tamm" (oak)
      return url.toLowerCase().includes('tamm');
    });

    console.log(`\nFiltered to ${productUrls.length} oak (TAMM) product URLs`);
    return productUrls;
  }

  async scrapeProductPage(url: string): Promise<PanelProduct | null> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log(`\nScraping: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(2000);

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

      const pricePerPiece = productData.pricePerPiece;
      const pricePerM2 = productData.pricePerM2;
      const stockData = { tallinn: productData.tallinn, tartu: productData.tartu };

      console.log(`  Species: ${species}`);
      console.log(`  Dimensions: ${dims.thickness}x${dims.width}x${dims.length}mm`);
      console.log(`  Quality: ${quality || 'N/A'}`);
      console.log(`  Price: €${pricePerPiece}/pc, €${pricePerM2}/m²`);
      console.log(`  Stock: Tallinn ${stockData.tallinn}, Tartu ${stockData.tartu}`);

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
    const allProducts: PanelProduct[] = [];
    let urls: string[] = [];

    // From-file mode: generate URLs from products-to-scrape.json
    if (options.fromFile) {
      console.log('\n--- FROM-FILE MODE: Scraping products from products-to-scrape.json ---');
      urls = this.generateUrlsFromFile();
    }
    // Full scan mode: comprehensive URL testing for all species/dimensions
    else if (options.full) {
      console.log('\n--- FULL SCAN MODE: Testing all species/dimension combinations ---');
      urls = await this.fullScan();
    }
    // Discovery mode: crawl category pages to find products
    else if (options.discover) {
      console.log('\n--- DISCOVERY MODE: Finding products from category pages ---');
      urls = await this.discoverAllProducts();
    }
    // Generate URLs from config if available
    else if (config && !options.noConfig) {
      console.log('\n--- Generating URLs from database config ---');
      console.log(`  Thicknesses: ${config.thicknesses.join(', ')}mm`);
      console.log(`  Widths: ${config.widths.join(', ')}mm`);
      console.log(`  Lengths: ${config.lengths.join(', ')}mm`);
      console.log(`  Qualities: ${config.qualities.join(', ')}`);
      urls = generateUrls(config);
      console.log(`  Generated ${urls.length} URLs to scrape`);
    } else {
      // Fallback: discover URLs dynamically
      console.log('\n--- Discovering product URLs (no config) ---');
      urls = await this.discoverOakPanelUrls();

      // If no oak URLs found or fewer than expected, add fallback known URLs
      if (urls.length < 5) {
        console.log('\nFew oak URLs discovered, adding fallback list...');
        const fallbackUrls = [
          // 20mm x 620mm width
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-800mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-900mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-1000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-1200mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-1500mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-2000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-620-x-2500mm-a-b',
          // 20mm x 1220mm width
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-800mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-900mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-1000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-1200mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-1500mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-2000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-20-x-1220-x-2100mm-a-b',
          // 26mm panels
          'https://mass.ee/liimpuit-tamm-pikk-lamell-26-x-620-x-1000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-26-x-620-x-2000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-26-x-1220-x-2000mm-a-b',
          // 30mm panels
          'https://mass.ee/liimpuit-tamm-pikk-lamell-30-x-620-x-1000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-30-x-620-x-2000mm-a-b',
          // 40mm panels
          'https://mass.ee/liimpuit-tamm-pikk-lamell-40-x-620-x-1000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-40-x-620-x-1450mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-40-x-620-x-2000mm-a-b',
          'https://mass.ee/liimpuit-tamm-pikk-lamell-40-x-1020-x-2000mm-a-b',
        ];
        // Merge fallback URLs with discovered URLs (avoid duplicates)
        for (const fallbackUrl of fallbackUrls) {
          if (!urls.includes(fallbackUrl)) {
            urls.push(fallbackUrl);
          }
        }
      }
    }

    console.log(`\n--- Processing ${urls.length} URLs ---`);

    for (const url of urls) {
      // Filter by thickness if specified via CLI (overrides config)
      if (options.thickness) {
        const urlDims = parseDimensions(url);
        if (urlDims && urlDims.thickness !== options.thickness) {
          continue;
        }
      }

      const product = await this.scrapeProductPage(url);
      if (product) {
        // Check thickness filter again on actual product (CLI override)
        if (options.thickness && product.thickness !== options.thickness) {
          continue;
        }

        // Check against config filters if using config (not in discovery mode)
        if (config && !options.noConfig && !options.discover) {
          if (!matchesConfig(config, product)) {
            console.log(`  Skipping (not in config): ${product.thickness}x${product.width}x${product.length}`);
            continue;
          }
        }

        allProducts.push(product);
      }

      // Be respectful - delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

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

  if (options.fromFile) {
    console.log('Mode: FROM-FILE (scraping products from products-to-scrape.json)');
  } else if (options.full) {
    console.log('Mode: FULL SCAN (testing all species/dimension combinations)');
    console.log('       This may take a while...');
  } else if (options.discover) {
    console.log('Mode: DISCOVERY (finding products from category pages)');
  }

  // Load config from database (skip if in discovery/full/fromFile mode)
  let config: ScraperConfig | null = null;
  if (!options.noConfig && !options.discover && !options.full && !options.fromFile) {
    console.log('Loading configuration from database...');
    config = await loadConfig('mass.ee');
    if (config) {
      if (!config.isEnabled) {
        console.log('Scraper is DISABLED in configuration. Exiting.');
        return;
      }
      console.log('Configuration loaded successfully');
    } else {
      console.log('No configuration found, using fallback URLs');
    }
  } else if (options.fromFile) {
    console.log('From-file mode - skipping database config');
  } else if (options.full) {
    console.log('Full scan mode - skipping database config');
  } else if (options.discover) {
    console.log('Discovery mode - skipping database config');
  } else {
    console.log('Skipping database config (--no-config)');
  }

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

    // Auto-save results to all-products.json (always save for fromFile/discover/full modes)
    if (options.fromFile || options.discover || options.full) {
      const outputPath = options.outputFile || 'all-products.json';
      const json = JSON.stringify(products, null, 2);
      fs.writeFileSync(outputPath, json);
      console.log(`Saved to: ${outputPath}`);
    }

    // Format output for display
    switch (options.outputFormat) {
      case 'json':
        const json = JSON.stringify(products, null, 2);
        if (options.outputFile && !options.fromFile && !options.discover && !options.full) {
          fs.writeFileSync(options.outputFile, json);
          console.log(`Saved to: ${options.outputFile}`);
        } else if (!options.fromFile && !options.discover && !options.full) {
          console.log(json);
        }
        break;
      case 'csv':
        const csv = formatAsCsv(products);
        if (options.outputFile) {
          fs.writeFileSync(options.outputFile, csv);
          console.log(`Saved to: ${options.outputFile}`);
        } else {
          console.log(csv);
        }
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
