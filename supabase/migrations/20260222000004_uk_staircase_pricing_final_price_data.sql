-- Update final_price_cents with prices from PDF (stored in cents, multiply GBP by 100)

-- Steps 110mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 9000 WHERE code = 'Step110FJ1000';
UPDATE uk_staircase_pricing SET final_price_cents = 10000 WHERE code = 'Step110FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 12000 WHERE code = 'Step110FJ1500';

-- Steps 110mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 11000 WHERE code = 'Step110FS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 13000 WHERE code = 'Step110FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 16000 WHERE code = 'Step110FS1500';

-- Steps 110mm FJFS
UPDATE uk_staircase_pricing SET final_price_cents = 10500 WHERE code = 'Step110FJFS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 12500 WHERE code = 'Step110FJFS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 15000 WHERE code = 'Step110FJFS1500';

-- Steps 22mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 4000 WHERE code = 'Step22FJ1000';
UPDATE uk_staircase_pricing SET final_price_cents = 4500 WHERE code = 'Step22FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 5000 WHERE code = 'Step22FJ1500';

-- Steps 22mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 4500 WHERE code = 'Step22FS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 5000 WHERE code = 'Step22FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 7000 WHERE code = 'Step22FS1500';

-- Step 70mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 11000 WHERE code = 'Step70FS1000';

-- Winders 110mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 19000 WHERE code = 'Winder110FJ1000';
UPDATE uk_staircase_pricing SET final_price_cents = 22000 WHERE code = 'Winder110FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 27000 WHERE code = 'Winder110FJ1400';
UPDATE uk_staircase_pricing SET final_price_cents = 32000 WHERE code = 'Winder110FJ1600';
UPDATE uk_staircase_pricing SET final_price_cents = 37000 WHERE code = 'Winder110FJ1800';

-- Winders 110mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 24000 WHERE code = 'Winder110FS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 28000 WHERE code = 'Winder110FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 34000 WHERE code = 'Winder110FS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 40000 WHERE code = 'Winder110FS1600';
UPDATE uk_staircase_pricing SET final_price_cents = 48000 WHERE code = 'Winder110FS1800';

-- Winders 110mm FJFS
UPDATE uk_staircase_pricing SET final_price_cents = 22000 WHERE code = 'Winder110FJFS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 27000 WHERE code = 'Winder110FJFS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 32000 WHERE code = 'Winder110FJFS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 38000 WHERE code = 'Winder110FJFS1600';
UPDATE uk_staircase_pricing SET final_price_cents = 44000 WHERE code = 'Winder110FJFS1800';

-- Winders 22mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 7000 WHERE code = 'Winder22FJ1000';
UPDATE uk_staircase_pricing SET final_price_cents = 8000 WHERE code = 'Winder22FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 10000 WHERE code = 'Winder22FJ1400';
UPDATE uk_staircase_pricing SET final_price_cents = 12000 WHERE code = 'Winder22FJ1600';
UPDATE uk_staircase_pricing SET final_price_cents = 14000 WHERE code = 'Winder22FJ1800';

-- Winders 22mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 8000 WHERE code = 'Winder22FS1000';
UPDATE uk_staircase_pricing SET final_price_cents = 10000 WHERE code = 'Winder22FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 12000 WHERE code = 'Winder22FS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 15000 WHERE code = 'Winder22FS1600';
UPDATE uk_staircase_pricing SET final_price_cents = 18000 WHERE code = 'Winder22FS1800';

-- Quarters 110mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 36000 WHERE code = 'Quarter110FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 50000 WHERE code = 'Quarter110FJ1400';
UPDATE uk_staircase_pricing SET final_price_cents = 73000 WHERE code = 'Quarter110FJ1700';

-- Quarters 110mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 48000 WHERE code = 'Quarter110FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 68000 WHERE code = 'Quarter110FS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 104000 WHERE code = 'Quarter110FS1700';

-- Quarters 110mm FJFS
UPDATE uk_staircase_pricing SET final_price_cents = 45000 WHERE code = 'Quarter110FJFS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 63000 WHERE code = 'Quarter110FJFS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 94000 WHERE code = 'Quarter110FJFS1700';

-- Quarters 22mm FJ
UPDATE uk_staircase_pricing SET final_price_cents = 11000 WHERE code = 'Quarter22FJ1200';
UPDATE uk_staircase_pricing SET final_price_cents = 14000 WHERE code = 'Quarter22FJ1400';
UPDATE uk_staircase_pricing SET final_price_cents = 20000 WHERE code = 'Quarter22FJ1700';

-- Quarters 22mm FS
UPDATE uk_staircase_pricing SET final_price_cents = 14000 WHERE code = 'Quarter22FS1200';
UPDATE uk_staircase_pricing SET final_price_cents = 19000 WHERE code = 'Quarter22FS1400';
UPDATE uk_staircase_pricing SET final_price_cents = 29000 WHERE code = 'Quarter22FS1700';

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
