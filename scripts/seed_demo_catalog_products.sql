-- DEMO catalog products — throwaway seed so the catalog + deal picker have data to
-- play with until the real legacy-inventory→catalog migration runs (task 9va5xt).
-- Everything here is slug-prefixed 'demo-' so it is trivially removable:
--   DELETE FROM catalog_variants WHERE product_id IN (SELECT id FROM catalog_products WHERE slug LIKE 'demo-%');
--   DELETE FROM catalog_products WHERE slug LIKE 'demo-%';
-- Idempotent (fixed UUIDs + ON CONFLICT DO NOTHING). Prices are EUR cents.
-- Categories (staging): firewood 866214f9-f4a1-4887-99ef-bcf1e07a4e68,
--   solid-wood-panels a0000001-0000-0000-0000-000000000001,
--   boards a0000001-0003-0000-0000-000000000001, stairs a0000001-0004-0000-0000-000000000001.

-- ── products ────────────────────────────────────────────────────────────────
INSERT INTO catalog_products (id, category_id, slug, name, description, is_active, sort_order, base_price_eur_cents, visible_agents, visible_internal) VALUES
 ('de300001-0001-0000-0000-000000000001','866214f9-f4a1-4887-99ef-bcf1e07a4e68','demo-birch-firewood','[DEMO] Birch Firewood','Kiln-dried birch firewood, demo product.',true,0,8500,true,true),
 ('de300001-0002-0000-0000-000000000001','866214f9-f4a1-4887-99ef-bcf1e07a4e68','demo-oak-firewood','[DEMO] Oak Firewood','Kiln-dried oak firewood, demo product.',true,1,11000,true,true),
 ('de300001-0003-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','demo-oak-panel','[DEMO] Oak Panel','Edge-glued oak panel, demo product.',true,0,6200,true,true),
 ('de300001-0004-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','demo-ash-panel','[DEMO] Ash Panel','Edge-glued ash panel, demo product.',true,1,5400,true,true),
 ('de300001-0005-0000-0000-000000000001','a0000001-0003-0000-0000-000000000001','demo-pine-board','[DEMO] Pine Board','Planed pine board, demo product.',true,0,3200,true,true),
 ('de300001-0006-0000-0000-000000000001','a0000001-0003-0000-0000-000000000001','demo-spruce-board','[DEMO] Spruce Board','Planed spruce board, demo product.',true,1,2900,true,true),
 ('de300001-0007-0000-0000-000000000001','a0000001-0004-0000-0000-000000000001','demo-oak-step','[DEMO] Oak Step','Solid oak stair step, demo product.',true,0,4500,true,true),
 ('de300001-0008-0000-0000-000000000001','a0000001-0004-0000-0000-000000000001','demo-pine-winder','[DEMO] Pine Winder','Pine winder step, demo product.',true,1,3800,true,true)
ON CONFLICT (id) DO NOTHING;

-- ── variants (each carries its own EUR price so the deal picker shows a live price) ──
INSERT INTO catalog_variants (id, product_id, sku, thickness_mm, width_mm, length_mm, is_active, sort_order, price_eur_cents, stock_quantity, stock_unit) VALUES
 ('de300002-0001-0000-0000-000000000001','de300001-0001-0000-0000-000000000001','DEMO-BIRCH-25',NULL,NULL,250,true,0,8500,120,'piece'),
 ('de300002-0002-0000-0000-000000000001','de300001-0001-0000-0000-000000000001','DEMO-BIRCH-33',NULL,NULL,330,true,1,9200,80,'piece'),
 ('de300002-0003-0000-0000-000000000001','de300001-0002-0000-0000-000000000001','DEMO-OAK-FW-33',NULL,NULL,330,true,0,11000,40,'piece'),
 ('de300002-0004-0000-0000-000000000001','de300001-0003-0000-0000-000000000001','DEMO-OAKPNL-40',40,620,2000,true,0,6200,25,'piece'),
 ('de300002-0005-0000-0000-000000000001','de300001-0003-0000-0000-000000000001','DEMO-OAKPNL-20',20,620,2000,true,1,4800,30,'piece'),
 ('de300002-0006-0000-0000-000000000001','de300001-0004-0000-0000-000000000001','DEMO-ASHPNL-40',40,620,2000,true,0,5400,18,'piece'),
 ('de300002-0007-0000-0000-000000000001','de300001-0005-0000-0000-000000000001','DEMO-PINE-22x95',22,95,4000,true,0,3200,300,'piece'),
 ('de300002-0008-0000-0000-000000000001','de300001-0005-0000-0000-000000000001','DEMO-PINE-22x120',22,120,4000,true,1,3800,220,'piece'),
 ('de300002-0009-0000-0000-000000000001','de300001-0006-0000-0000-000000000001','DEMO-SPRUCE-22x95',22,95,4000,true,0,2900,260,'piece'),
 ('de300002-0010-0000-0000-000000000001','de300001-0007-0000-0000-000000000001','DEMO-OAKSTEP-1000',40,300,1000,true,0,4500,15,'piece'),
 ('de300002-0011-0000-0000-000000000001','de300001-0008-0000-0000-000000000001','DEMO-PINEWIND',40,700,700,true,0,3800,12,'piece')
ON CONFLICT (id) DO NOTHING;
