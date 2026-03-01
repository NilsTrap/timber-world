-- Seed UK Staircase Pricing Data
-- All prices stored in cents (multiply EUR values by 100)
-- GBP rate stored as 9000 = 0.90

INSERT INTO uk_staircase_pricing (code, name, product_type, thickness_mm, width_mm, riser_mm, length_mm, eur_per_m3_cents, work_cost_cents, transport_cost_cents, gbp_rate, sort_order) VALUES
-- Steps 110mm FJ
('Step110FJ1000', 'Step', 'FJ', 110, 280, NULL, 1000, 200000, 2800, 924, 9000, 1),
('Step110FJ1200', 'Step', 'FJ', 110, 280, NULL, 1200, 200000, 2800, 1109, 9000, 2),
('Step110FJ1500', 'Step', 'FJ', 110, 280, NULL, 1500, 200000, 2800, 1386, 9000, 3),
-- Steps 110mm FS
('Step110FS1000', 'Step', 'FS', 110, 280, NULL, 1000, 260000, 2800, 924, 9000, 4),
('Step110FS1200', 'Step', 'FS', 110, 280, NULL, 1200, 272000, 2800, 1109, 9000, 5),
('Step110FS1500', 'Step', 'FS', 110, 280, NULL, 1500, 284000, 2800, 1386, 9000, 6),
-- Steps 110mm FJFS
('Step110FJFS1000', 'Step', 'FJFS', 110, 280, NULL, 1000, 240000, 2800, 924, 9000, 7),
('Step110FJFS1200', 'Step', 'FJFS', 110, 280, NULL, 1200, 248000, 2800, 1109, 9000, 8),
('Step110FJFS1500', 'Step', 'FJFS', 110, 280, NULL, 1500, 256000, 2800, 1386, 9000, 9),
-- Steps 22mm FJ
('Step22FJ1000', 'Step', 'FJ', 22, 280, 200, 1000, 220000, 1000, 317, 9000, 10),
('Step22FJ1200', 'Step', 'FJ', 22, 280, 200, 1200, 220000, 1000, 380, 9000, 11),
('Step22FJ1500', 'Step', 'FJ', 22, 280, 200, 1500, 220000, 1000, 475, 9000, 12),
-- Steps 22mm FS
('Step22FS1000', 'Step', 'FS', 22, 280, 200, 1000, 300000, 1000, 317, 9000, 13),
('Step22FS1200', 'Step', 'FS', 22, 280, 200, 1200, 320000, 1000, 380, 9000, 14),
('Step22FS1500', 'Step', 'FS', 22, 280, 200, 1500, 340000, 1000, 475, 9000, 15),
-- Step 70mm FS
('Step70FS1000', 'Step', 'FS', 70, 280, NULL, 1000, 277777, 2800, 588, 9000, 16),
-- Winders 110mm FJ
('Winder110FJ1000', 'Winder', 'FJ', 110, 750, NULL, 1000, 200000, 5000, 1980, 9000, 17),
('Winder110FJ1200', 'Winder', 'FJ', 110, 750, NULL, 1200, 200000, 6000, 2376, 9000, 18),
('Winder110FJ1400', 'Winder', 'FJ', 110, 750, NULL, 1400, 200000, 8000, 2772, 9000, 19),
('Winder110FJ1600', 'Winder', 'FJ', 110, 750, NULL, 1600, 200000, 10000, 3168, 9000, 20),
('Winder110FJ1800', 'Winder', 'FJ', 110, 750, NULL, 1800, 200000, 12000, 3564, 9000, 21),
-- Winders 110mm FS
('Winder110FS1000', 'Winder', 'FS', 110, 750, NULL, 1000, 260000, 5000, 1980, 9000, 22),
('Winder110FS1200', 'Winder', 'FS', 110, 750, NULL, 1200, 272000, 6000, 2376, 9000, 23),
('Winder110FS1400', 'Winder', 'FS', 110, 750, NULL, 1400, 272000, 8000, 2772, 9000, 24),
('Winder110FS1600', 'Winder', 'FS', 110, 750, NULL, 1600, 284000, 10000, 3168, 9000, 25),
('Winder110FS1800', 'Winder', 'FS', 110, 750, NULL, 1800, 296000, 12000, 3564, 9000, 26),
-- Winders 110mm FJFS
('Winder110FJFS1000', 'Winder', 'FJFS', 110, 750, NULL, 1000, 240000, 5000, 1980, 9000, 27),
('Winder110FJFS1200', 'Winder', 'FJFS', 110, 750, NULL, 1200, 248000, 6000, 2376, 9000, 28),
('Winder110FJFS1400', 'Winder', 'FJFS', 110, 750, NULL, 1400, 248000, 8000, 2772, 9000, 29),
('Winder110FJFS1600', 'Winder', 'FJFS', 110, 750, NULL, 1600, 256000, 10000, 3168, 9000, 30),
('Winder110FJFS1800', 'Winder', 'FJFS', 110, 750, NULL, 1800, 264000, 12000, 3564, 9000, 31),
-- Winders 22mm FJ
('Winder22FJ1000', 'Winder', 'FJ', 22, 750, 200, 1000, 220000, 2500, 502, 9000, 32),
('Winder22FJ1200', 'Winder', 'FJ', 22, 750, 200, 1200, 220000, 3000, 602, 9000, 33),
('Winder22FJ1400', 'Winder', 'FJ', 22, 750, 200, 1400, 220000, 4000, 702, 9000, 34),
('Winder22FJ1600', 'Winder', 'FJ', 22, 750, 200, 1600, 220000, 5000, 803, 9000, 35),
('Winder22FJ1800', 'Winder', 'FJ', 22, 750, 200, 1800, 220000, 6000, 903, 9000, 36),
-- Winders 22mm FS
('Winder22FS1000', 'Winder', 'FS', 22, 750, 200, 1000, 300000, 2500, 502, 9000, 37),
('Winder22FS1200', 'Winder', 'FS', 22, 750, 200, 1200, 320000, 3000, 602, 9000, 38),
('Winder22FS1400', 'Winder', 'FS', 22, 750, 200, 1400, 320000, 4000, 702, 9000, 39),
('Winder22FS1600', 'Winder', 'FS', 22, 750, 200, 1600, 340000, 5000, 803, 9000, 40),
('Winder22FS1800', 'Winder', 'FS', 22, 750, 200, 1800, 360000, 6000, 903, 9000, 41),
-- Quarters 110mm FJ
('Quarter110FJ1200', 'Quarter', 'FJ', 110, 1200, NULL, 1200, 200000, 4000, 4752, 9000, 42),
('Quarter110FJ1400', 'Quarter', 'FJ', 110, 1400, NULL, 1400, 200000, 6000, 6468, 9000, 43),
('Quarter110FJ1700', 'Quarter', 'FJ', 110, 1700, NULL, 1700, 200000, 8000, 9537, 9000, 44),
-- Quarters 110mm FS
('Quarter110FS1200', 'Quarter', 'FS', 110, 1200, NULL, 1200, 272000, 4000, 4752, 9000, 45),
('Quarter110FS1400', 'Quarter', 'FS', 110, 1400, NULL, 1400, 284000, 6000, 6468, 9000, 46),
('Quarter110FS1700', 'Quarter', 'FS', 110, 1700, NULL, 1700, 296000, 8000, 9537, 9000, 47),
-- Quarters 110mm FJFS
('Quarter110FJFS1200', 'Quarter', 'FJFS', 110, 1200, NULL, 1200, 248000, 4000, 4752, 9000, 48),
('Quarter110FJFS1400', 'Quarter', 'FJFS', 110, 1400, NULL, 1400, 256000, 6000, 6468, 9000, 49),
('Quarter110FJFS1700', 'Quarter', 'FJFS', 110, 1700, NULL, 1700, 264000, 8000, 9537, 9000, 50),
-- Quarters 22mm FJ
('Quarter22FJ1200', 'Quarter', 'FJ', 22, 1200, 200, 1200, 220000, 2000, 1109, 9000, 51),
('Quarter22FJ1400', 'Quarter', 'FJ', 22, 1400, 200, 1400, 220000, 2500, 1478, 9000, 52),
('Quarter22FJ1700', 'Quarter', 'FJ', 22, 1700, 200, 1700, 220000, 3000, 2132, 9000, 53),
-- Quarters 22mm FS
('Quarter22FS1200', 'Quarter', 'FS', 22, 1200, 200, 1200, 320000, 2000, 1109, 9000, 54),
('Quarter22FS1400', 'Quarter', 'FS', 22, 1400, 200, 1400, 340000, 2500, 1478, 9000, 55),
('Quarter22FS1700', 'Quarter', 'FS', 22, 1700, 200, 1700, 360000, 3000, 2132, 9000, 56);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
