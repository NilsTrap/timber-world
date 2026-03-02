/**
 * Create competitor pricing comparison CSV
 * Combines mass.ee scraped data with Timber International inventory
 */

import * as fs from 'fs';

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

interface TIProduct {
  species: string;
  processing: 'FJ' | 'FS';
  quality: string;
  thickness: number;
  width: number;
  length: number;
}

// Determine panel type from URL or name
function getPanelType(product: MassProduct): string {
  if (product.url.includes('sormjatk') || product.name.toLowerCase().includes('sõrmjätk')) {
    return 'FJ';
  }
  if (product.url.includes('pikk-lamell') || product.name.toLowerCase().includes('pikk lamell')) {
    return 'FS';
  }
  return '';
}

// Create product key for matching
function makeKey(species: string, panelType: string, thickness: number, width: number, length: number): string {
  return `${species}-${panelType}-${thickness}x${width}x${length}`;
}

function main() {
  // Load mass.ee products
  const massProducts: MassProduct[] = JSON.parse(
    fs.readFileSync('all-products.json', 'utf-8')
  );

  // Load Timber International products (for reference)
  const tiProducts: TIProduct[] = JSON.parse(
    fs.readFileSync('products-to-scrape.json', 'utf-8')
  );

  // Create set of TI products for matching
  const tiProductSet = new Set<string>();
  for (const ti of tiProducts) {
    const key = makeKey(ti.species, ti.processing, ti.thickness, ti.width, ti.length);
    tiProductSet.add(key);
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
    'Species',
    'Type',
    'Thickness (mm)',
    'Width (mm)',
    'Length (mm)',
    'Quality',
    'Mass.ee Price (€/pc)',
    'Mass.ee Price (€/m²)',
    'TI Price (€/pc)',
    'TI Price (€/m²)',
    'Price Diff (%)',
    'Mass.ee Stock',
    'In TI Inventory'
  ];

  const rows: string[][] = [];

  for (const p of massProducts) {
    const panelType = getPanelType(p);
    const key = makeKey(p.species, panelType, p.thickness, p.width, p.length);
    const inTI = tiProductSet.has(key);

    rows.push([
      p.species.charAt(0).toUpperCase() + p.species.slice(1),
      panelType,
      String(p.thickness),
      String(p.width),
      String(p.length),
      p.quality || 'N/A',
      p.pricePerPiece.toFixed(2),
      p.pricePerM2.toFixed(2),
      '', // TI price per piece - to be filled
      '', // TI price per m2 - to be filled
      '', // Price difference - to be calculated
      String(p.totalStock),
      inTI ? 'Yes' : 'No'
    ]);
  }

  // Write CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  fs.writeFileSync('competitor-pricing-comparison.csv', csvContent);
  console.log(`Created competitor-pricing-comparison.csv with ${rows.length} products`);

  // Print summary
  const speciesCounts: Record<string, number> = {};
  for (const p of massProducts) {
    speciesCounts[p.species] = (speciesCounts[p.species] || 0) + 1;
  }

  console.log('\nSummary:');
  console.log(`  Total products: ${massProducts.length}`);
  console.log(`  In TI inventory: ${rows.filter(r => r[12] === 'Yes').length}`);
  console.log(`  Species: ${Object.entries(speciesCounts).map(([s, c]) => `${s}: ${c}`).join(', ')}`);

  // Also create a formatted table view
  console.log('\n--- COMPETITOR PRICING COMPARISON ---');
  console.log('');
  console.log('Species     | Type | Dimensions      | Quality | Mass.ee €/pc | Mass.ee €/m² | Stock | In TI?');
  console.log('------------|------|-----------------|---------|--------------|--------------|-------|-------');

  for (const p of massProducts.slice(0, 50)) { // First 50 for preview
    const panelType = getPanelType(p);
    const key = makeKey(p.species, panelType, p.thickness, p.width, p.length);
    const inTI = tiProductSet.has(key);

    console.log(
      `${p.species.padEnd(11)} | ${panelType.padEnd(4)} | ${p.thickness}x${p.width}x${p.length}`.padEnd(16) +
      ` | ${(p.quality || 'N/A').padEnd(7)} | ${('€' + p.pricePerPiece.toFixed(2)).padStart(12)} | ${('€' + p.pricePerM2.toFixed(2)).padStart(12)} | ${String(p.totalStock).padStart(5)} | ${inTI ? 'Yes' : 'No'}`
    );
  }

  if (massProducts.length > 50) {
    console.log(`... and ${massProducts.length - 50} more products (see CSV file)`);
  }
}

main();
