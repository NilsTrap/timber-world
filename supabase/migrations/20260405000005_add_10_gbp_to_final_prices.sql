-- Add £10 (1000 cents) to all final prices
UPDATE uk_staircase_pricing
SET final_price_cents = final_price_cents + 1000;
