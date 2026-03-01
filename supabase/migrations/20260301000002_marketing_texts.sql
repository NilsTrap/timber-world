-- Marketing Texts CMS Table
-- Created: 2026-03-01
-- Manages editable text content for the marketing website

-- Marketing Texts table
CREATE TABLE marketing_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,           -- e.g., 'journey', 'hero', 'footer'
  section TEXT NOT NULL,            -- e.g., 'forest', 'sawmill'
  key TEXT NOT NULL,                -- e.g., 'title', 'description', 'maturingTitle'
  locale TEXT NOT NULL DEFAULT 'en',
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, section, key, locale)
);

-- Indexes
CREATE INDEX idx_marketing_texts_category ON marketing_texts(category);
CREATE INDEX idx_marketing_texts_section ON marketing_texts(section);
CREATE INDEX idx_marketing_texts_locale ON marketing_texts(locale);

-- Updated_at trigger
CREATE TRIGGER update_marketing_texts_updated_at
  BEFORE UPDATE ON marketing_texts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (admin-only access enforced at application level)
ALTER TABLE marketing_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to marketing_texts"
  ON marketing_texts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with English journey texts
INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
-- Forest
('journey', 'forest', 'title', 'en', 'Forest', 1),
('journey', 'forest', 'description', 'en', 'Where every great piece begins — in silence, patience, and time', 2),
('journey', 'forest', 'maturingTitle', 'en', 'Decades of Patience', 3),
('journey', 'forest', 'maturingDescription', 'en', 'Decades of sun, rain, and stillness shape every oak before we ever arrive. Each ring is a promise of the strength our products will carry.', 4),
('journey', 'forest', 'harvestingTitle', 'en', 'Respectful Harvest', 5),
('journey', 'forest', 'harvestingDescription', 'en', 'We harvest only what the forest is ready to give — honouring generations of growth with the care each tree deserves.', 6),
('journey', 'forest', 'renewingTitle', 'en', 'Promise Renewed', 7),
('journey', 'forest', 'renewingDescription', 'en', 'For every tree we take, new life returns to the land. A covenant with the future, not a policy.', 8),

-- Sawmill
('journey', 'sawmill', 'title', 'en', 'Sawmill', 10),
('journey', 'sawmill', 'description', 'en', 'The first transformation — where raw timber reveals its character', 11),
('journey', 'sawmill', 'gradingTitle', 'en', 'Eye of Experience', 12),
('journey', 'sawmill', 'gradingDescription', 'en', 'Not every log meets our standard. Our specialists read the timber like a score — sensing the grain, density, and hidden potential.', 13),
('journey', 'sawmill', 'sawingTitle', 'en', 'Unlocking Potential', 14),
('journey', 'sawmill', 'sawingDescription', 'en', 'Each saw line is placed to unlock the wood''s finest expression — maximising yield while respecting its natural structure.', 15),
('journey', 'sawmill', 'stackingTitle', 'en', 'Care from the Start', 16),
('journey', 'sawmill', 'stackingDescription', 'en', 'Quality is not something we add later. From the first board off the saw, careful handling ensures nothing is lost.', 17),

-- Kiln
('journey', 'kiln', 'title', 'en', 'Kiln', 20),
('journey', 'kiln', 'description', 'en', 'The quiet discipline of drying — where patience becomes permanence', 21),
('journey', 'kiln', 'arrangingTitle', 'en', 'Careful Alignment', 22),
('journey', 'kiln', 'arrangingDescription', 'en', 'Every board stickered, spaced, and aligned with precision. Meticulous care most will never see, yet it defines the stability we deliver.', 23),
('journey', 'kiln', 'dryingTitle', 'en', 'Gentle Release', 24),
('journey', 'kiln', 'dryingDescription', 'en', 'We guide the moisture out gently — never rushing, never forcing. The wood tells us when it is ready, and we listen.', 25),
('journey', 'kiln', 'protectingTitle', 'en', 'Stability Secured', 26),
('journey', 'kiln', 'protectingDescription', 'en', 'At ideal moisture content, timber is restacked and protected. This is where our promise of dimensional stability truly begins.', 27),

-- Factory
('journey', 'factory', 'title', 'en', 'Factory', 30),
('journey', 'factory', 'description', 'en', 'Precision engineering rooted in deep respect for the material', 31),
('journey', 'factory', 'multisawTitle', 'en', 'Optimal Division', 32),
('journey', 'factory', 'multisawDescription', 'en', 'Surgical accuracy extracts optimal widths from each board. Wasting good oak means wasting the years it took to grow.', 33),
('journey', 'factory', 'opticutTitle', 'en', 'Nothing Wasted', 34),
('journey', 'factory', 'opticutDescription', 'en', 'Intelligent crosscutting preserves every usable centimetre. Nothing worthy is left behind.', 35),
('journey', 'factory', 'planingTitle', 'en', 'True Face', 36),
('journey', 'factory', 'planingDescription', 'en', 'The planer reveals oak''s true face — smooth, alive with grain. One of the most honest moments in our process.', 37),
('journey', 'factory', 'fingerjointingTitle', 'en', 'Strength United', 38),
('journey', 'factory', 'fingerjointingDescription', 'en', 'Precision joints connect the finest parts of every board — eliminating waste, engineered to last as long as the solid wood itself.', 39),
('journey', 'factory', 'gluingTitle', 'en', 'Becoming Whole', 40),
('journey', 'factory', 'gluingDescription', 'en', 'Under controlled pressure, individual lamellae become unified panels. Our adhesives are chosen for integrity, not cost.', 41),
('journey', 'factory', 'calibratingTitle', 'en', 'Exact Promise', 42),
('journey', 'factory', 'calibratingDescription', 'en', 'Wide-belt sanders bring each panel to exact thickness, measured in fractions of a millimetre. Precision you can build on.', 43),

-- Workshop
('journey', 'workshop', 'title', 'en', 'Workshop', 50),
('journey', 'workshop', 'description', 'en', 'Your vision, our craftsmanship — where standard becomes bespoke', 51),
('journey', 'workshop', 'cncTitle', 'en', 'Your Vision Shaped', 52),
('journey', 'workshop', 'cncDescription', 'en', 'Profiles, curves, and edges shaped to your exact specifications. Technology in the service of tradition, never the other way around.', 53),
('journey', 'workshop', 'bondingTitle', 'en', 'Bonds That Last', 54),
('journey', 'workshop', 'bondingDescription', 'en', 'Every custom joint is a quiet commitment — what we build together will hold together, for the lifetime of the product.', 55),
('journey', 'workshop', 'sandingTitle', 'en', 'Touch of Craft', 56),
('journey', 'workshop', 'sandingDescription', 'en', 'The surface a customer touches tells them everything about the quality behind it. We make sure it speaks well.', 57),
('journey', 'workshop', 'finishingTitle', 'en', 'Silent Protection', 58),
('journey', 'workshop', 'finishingDescription', 'en', 'Each coat seals the beauty and shields against daily life. Protection that works silently for years so the oak can speak for itself.', 59),
('journey', 'workshop', 'packagingTitle', 'en', 'Safe Passage', 60),
('journey', 'workshop', 'packagingDescription', 'en', 'Every surface carefully wrapped and packed before it leaves our hands. Not an afterthought — a final gesture of care.', 61),

-- Warehouse
('journey', 'warehouse', 'title', 'en', 'Warehouse', 70),
('journey', 'warehouse', 'description', 'en', 'Nothing leaves until it has earned the right to carry our name', 71),
('journey', 'warehouse', 'controllingTitle', 'en', 'Earning Our Name', 72),
('journey', 'warehouse', 'controllingDescription', 'en', 'Dimensions, moisture, surface, structure — all inspected personally. If it does not meet our standard, it does not leave our facility.', 73),
('journey', 'warehouse', 'storingTitle', 'en', 'Trust Rewarded', 74),
('journey', 'warehouse', 'storingDescription', 'en', 'Labelled, documented, secured. The trust you place in us is rewarded in every detail.', 75),
('journey', 'warehouse', 'deliveringTitle', 'en', 'Into Your Hands', 76),
('journey', 'warehouse', 'deliveringDescription', 'en', 'The last physical act of care our team performs. Tracked, reliable, respected cargo — a product is only truly finished when it arrives safely in your hands.', 77),
('journey', 'warehouse', 'feedbackTitle', 'en', 'Growing Together', 78),
('journey', 'warehouse', 'feedbackDescription', 'en', 'We ask, we listen, we learn. Your voice shapes our future, and we are grateful for every word.', 79);
