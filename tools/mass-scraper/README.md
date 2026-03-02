# Mass.ee Oak Panel Scraper

Web scraper for extracting solid wood panel data from mass.ee website (Estonia).

## Features

- Extracts oak (tamm) panel products with dimensions, prices, and stock levels
- Supports filtering by thickness (e.g., 20mm only)
- Multiple output formats: table, JSON, CSV
- Stock availability for both Tallinn and Tartu locations
- Dynamic URL discovery plus fallback product list
- Debug mode for troubleshooting

## Installation

```bash
cd tools/mass-scraper
pnpm install
npx playwright install chromium
```

## Usage

```bash
# Scrape all oak panels
pnpm scrape

# Scrape only 20mm panels
pnpm scrape:20mm

# With custom options
npx tsx scraper.ts --thickness 20 --output json --file output.json
npx tsx scraper.ts --output csv --file panels.csv
npx tsx scraper.ts --debug  # Enable debug output
```

## Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--thickness` | Filter by thickness (mm) | `--thickness 20` |
| `--output` | Output format: table, json, csv | `--output json` |
| `--file` | Save to file | `--file results.json` |
| `--debug` | Enable debug output | `--debug` |

## Output Data

Each product includes:

- **name**: Product name/title (e.g., "Liimpuit TAMM pikk lamell 20 x 1220 x 800mm A/B")
- **thickness**: Panel thickness in mm
- **width**: Panel width in mm
- **length**: Panel length in mm
- **quality**: Quality grade (A/B, B/C, etc.)
- **pricePerPiece**: Price per piece in EUR
- **pricePerM2**: Price per square meter in EUR
- **stockTallinn**: Stock quantity in Tallinn
- **stockTartu**: Stock quantity in Tartu
- **totalStock**: Combined stock
- **url**: Product page URL
- **scrapedAt**: Timestamp of scraping

## Example Output

```
============================================================
| Thickness | Width  | Length | Quality | Price/pc  | Price/m² | Tallinn | Tartu | Total | Name
|---------------------------------------------------------------------------------------------------------------------------|
|     20mm | 1220mm |  800mm | A/B     | €  91.13 | €  0.00 |       3 |     0 |     3 | Liimpuit TAMM pikk lamell 20 x 1220
|     20mm | 1220mm |  900mm | A/B     | €  91.13 | €  0.00 |       3 |     0 |     3 | Liimpuit TAMM pikk lamell 20 x 1220
|     20mm | 1220mm | 1000mm | A/B     | €  91.13 | €  0.00 |       3 |     0 |     3 | Liimpuit TAMM pikk lamell 20 x 1220
============================================================

Summary:
  Products: 7
  Total stock: 21 pieces
  Thicknesses: 20mm
  Average price: €91.13/piece
```

## Available Products

The scraper looks for these oak panel sizes:

**20mm thickness (1220mm width):**
- 800mm, 900mm, 1000mm, 1200mm, 1500mm, 2000mm, 2100mm lengths

**Other thicknesses:**
- 26mm, 30mm, 40mm panels in various sizes

Note: Some URL patterns (especially 620mm width) may redirect to homepage if products are not currently available.

## Notes

- The scraper uses Playwright with Chromium in headless mode
- Be respectful of the website - includes 1.5s delays between requests
- Stock levels change frequently - run regularly for accurate data
- Product names are in Estonian (tamm = oak, liimpuit = glued wood panel)
- The site uses Estonian locale for proper content display

## Technical Details

The scraper:
1. First attempts to discover product URLs from category pages
2. Falls back to a comprehensive list of known URLs
3. Filters for oak (TAMM) products only
4. Extracts dimensions from page title and body text
5. Parses prices and stock from page content

## Troubleshooting

If products return "MASS" as title with no dimensions:
- The product URL may be outdated or discontinued
- The product might have been removed from inventory

Use `--debug` flag to see more details about page content.
