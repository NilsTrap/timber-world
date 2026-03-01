-- Update Product Texts
-- Created: 2026-03-01
-- Update product titles to match alt texts and add proper descriptions

-- Product 1: Oak Stair Cladding
UPDATE marketing_texts
SET value = 'Oak Stair Cladding'
WHERE category = 'products' AND section = 'product-1' AND key = 'title';

UPDATE marketing_texts
SET value = 'Transform your existing stairs with our premium oak cladding system. A cost-effective way to achieve a stunning solid oak look without full staircase replacement.'
WHERE category = 'products' AND section = 'product-1' AND key = 'description';

-- Product 2: Oak Stair Renovation Set
UPDATE marketing_texts
SET value = 'Oak Stair Renovation Set'
WHERE category = 'products' AND section = 'product-2' AND key = 'title';

UPDATE marketing_texts
SET value = 'Complete renovation kits including treads, risers, and nosings. Everything you need to upgrade your staircase to beautiful solid oak.'
WHERE category = 'products' AND section = 'product-2' AND key = 'description';

-- Product 3: Oak Handrails
UPDATE marketing_texts
SET value = 'Oak Handrails'
WHERE category = 'products' AND section = 'product-3' AND key = 'title';

UPDATE marketing_texts
SET value = 'Elegantly profiled oak handrails in various styles and dimensions. Smooth to the touch with a natural warmth that complements any interior.'
WHERE category = 'products' AND section = 'product-3' AND key = 'description';

-- Product 4: Oak Beams for Central Spine or Floating Staircases
UPDATE marketing_texts
SET value = 'Oak Beams for Central Spine or Floating Staircases'
WHERE category = 'products' AND section = 'product-4' AND key = 'title';

UPDATE marketing_texts
SET value = 'Structural oak beams engineered for modern staircase designs. Perfect for creating striking floating stairs or central spine configurations.'
WHERE category = 'products' AND section = 'product-4' AND key = 'description';

-- Product 5: CNC Machined Oak Stair Parts
UPDATE marketing_texts
SET value = 'CNC Machined Oak Stair Parts'
WHERE category = 'products' AND section = 'product-5' AND key = 'title';

UPDATE marketing_texts
SET value = 'Precision-engineered oak components made to your exact specifications. Custom profiles, complex shapes, and tight tolerances achieved with advanced CNC technology.'
WHERE category = 'products' AND section = 'product-5' AND key = 'description';

-- Product 6: Oak Tread
UPDATE marketing_texts
SET value = 'Oak Treads'
WHERE category = 'products' AND section = 'product-6' AND key = 'title';

UPDATE marketing_texts
SET value = 'Solid oak stair treads available in standard and custom sizes. Choose from finger jointed or full stave construction with various edge profiles.'
WHERE category = 'products' AND section = 'product-6' AND key = 'description';

-- Product 7: Oak Solid Wood Panels
UPDATE marketing_texts
SET value = 'Oak Solid Wood Panels'
WHERE category = 'products' AND section = 'product-7' AND key = 'title';

UPDATE marketing_texts
SET value = 'Premium oak panels for furniture, worktops, shelving, and architectural applications. Available in various thicknesses, widths, and quality grades.'
WHERE category = 'products' AND section = 'product-7' AND key = 'description';

-- Products 8-10: Keep generic until images are uploaded
UPDATE marketing_texts
SET value = 'Coming Soon'
WHERE category = 'products' AND section = 'product-8' AND key = 'title';

UPDATE marketing_texts
SET value = 'New product coming soon. Check back for updates.'
WHERE category = 'products' AND section = 'product-8' AND key = 'description';

UPDATE marketing_texts
SET value = 'Coming Soon'
WHERE category = 'products' AND section = 'product-9' AND key = 'title';

UPDATE marketing_texts
SET value = 'New product coming soon. Check back for updates.'
WHERE category = 'products' AND section = 'product-9' AND key = 'description';

UPDATE marketing_texts
SET value = 'Coming Soon'
WHERE category = 'products' AND section = 'product-10' AND key = 'title';

UPDATE marketing_texts
SET value = 'New product coming soon. Check back for updates.'
WHERE category = 'products' AND section = 'product-10' AND key = 'description';
