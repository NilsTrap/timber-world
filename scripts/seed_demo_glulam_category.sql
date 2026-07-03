-- DEMO rich catalog category: "[DEMO] Custom Glulam Beams" — a made-up category
-- with a LOT of fields (7 selects w/ options, 4 numbers w/ units, 2 booleans,
-- 2 FILE-upload fields, 1 text) + one fully-specced product with 2 attached files,
-- so we can see how a complex product looks & feels. Throwaway; idempotent.
-- Files were uploaded to the catalog-files bucket under demo-glulam/<productId>/.
-- CLEANUP:
--   delete from catalog_product_field_values where product_id in (select id from catalog_products where category_id='de400000-0000-0000-0000-000000000001');
--   delete from catalog_variants where product_id in (select id from catalog_products where category_id='de400000-0000-0000-0000-000000000001');
--   delete from catalog_products where category_id='de400000-0000-0000-0000-000000000001';
--   delete from catalog_category_field_assignments where category_id='de400000-0000-0000-0000-000000000001';
--   delete from catalog_field_options where field_id in (select id from catalog_fields where field_key like 'demo_%');
--   delete from catalog_fields where field_key like 'demo_%';
--   delete from catalog_categories where id='de400000-0000-0000-0000-000000000001';

-- ── category ──────────────────────────────────────────────────────────────
INSERT INTO catalog_categories (id, slug, name, description, primary_unit, is_active, sort_order, visible_agents, visible_internal, visible_marketing) VALUES
('de400000-0000-0000-0000-000000000001','demo-glulam-beams','[DEMO] Custom Glulam Beams','Engineered glue-laminated structural beams — a made-up demo category with a rich field set (species, strength class, glue, finish, service/fire class, moisture, density, camber, FSC/CE flags) plus a technical datasheet and a CAD drawing file upload.','piece',true,10,true,true,false)
ON CONFLICT (id) DO NOTHING;

-- ── fields (16) ───────────────────────────────────────────────────────────
INSERT INTO catalog_fields (id, field_key, field_label, field_type, unit, is_system) VALUES
('de4f0001-0000-0000-0000-000000000001','demo_species','Wood Species','select',NULL,false),
('de4f0002-0000-0000-0000-000000000001','demo_strength_class','Strength Class','select',NULL,false),
('de4f0003-0000-0000-0000-000000000001','demo_glue_type','Glue Type','select',NULL,false),
('de4f0004-0000-0000-0000-000000000001','demo_surface','Surface Finish','select',NULL,false),
('de4f0005-0000-0000-0000-000000000001','demo_service_class','Service Class','select',NULL,false),
('de4f0006-0000-0000-0000-000000000001','demo_fire_rating','Fire Rating','select',NULL,false),
('de4f0007-0000-0000-0000-000000000001','demo_treatment','Treatment','select',NULL,false),
('de4f0008-0000-0000-0000-000000000001','demo_moisture_pct','Moisture Content','number','%',false),
('de4f0009-0000-0000-0000-000000000001','demo_density','Density','number','kg/m3',false),
('de4f0010-0000-0000-0000-000000000001','demo_lam_thickness','Lamination Thickness','number','mm',false),
('de4f0011-0000-0000-0000-000000000001','demo_camber','Camber','number','mm',false),
('de4f0012-0000-0000-0000-000000000001','demo_fsc_certified','FSC Certified','boolean',NULL,false),
('de4f0013-0000-0000-0000-000000000001','demo_ce_marked','CE Marked (EN 14080)','boolean',NULL,false),
('de4f0014-0000-0000-0000-000000000001','demo_datasheet','Technical Datasheet','file',NULL,false),
('de4f0015-0000-0000-0000-000000000001','demo_cad_drawing','CAD Drawing','file',NULL,false),
('de4f0016-0000-0000-0000-000000000001','demo_notes','Notes','text',NULL,false)
ON CONFLICT (id) DO NOTHING;

-- ── select options (27) ───────────────────────────────────────────────────
INSERT INTO catalog_field_options (id, field_id, value, label, sort_order, is_active) VALUES
('de4c0101-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','spruce','Spruce',0,true),
('de4c0102-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','pine','Pine',1,true),
('de4c0103-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','larch','Larch',2,true),
('de4c0104-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','oak','Oak',3,true),
('de4c0105-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','douglas','Douglas Fir',4,true),
('de4c0201-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','gl24h','GL24h',0,true),
('de4c0202-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','gl28h','GL28h',1,true),
('de4c0203-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','gl30h','GL30h',2,true),
('de4c0204-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','gl32h','GL32h',3,true),
('de4c0301-0000-0000-0000-000000000001','de4f0003-0000-0000-0000-000000000001','muf','MUF',0,true),
('de4c0302-0000-0000-0000-000000000001','de4f0003-0000-0000-0000-000000000001','pur','PUR',1,true),
('de4c0303-0000-0000-0000-000000000001','de4f0003-0000-0000-0000-000000000001','prf','PRF',2,true),
('de4c0401-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','planed','Planed',0,true),
('de4c0402-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','sanded','Sanded',1,true),
('de4c0403-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','sawn','Sawn',2,true),
('de4c0404-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','brushed','Brushed',3,true),
('de4c0501-0000-0000-0000-000000000001','de4f0005-0000-0000-0000-000000000001','sc1','Service Class 1',0,true),
('de4c0502-0000-0000-0000-000000000001','de4f0005-0000-0000-0000-000000000001','sc2','Service Class 2',1,true),
('de4c0503-0000-0000-0000-000000000001','de4f0005-0000-0000-0000-000000000001','sc3','Service Class 3',2,true),
('de4c0601-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','none','None',0,true),
('de4c0602-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','r30','R30',1,true),
('de4c0603-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','r60','R60',2,true),
('de4c0604-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','r90','R90',3,true),
('de4c0701-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','none','None',0,true),
('de4c0702-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','impregnated','Impregnated',1,true),
('de4c0703-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','fire_retardant','Fire-retardant',2,true),
('de4c0704-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','oiled','Oiled',3,true)
ON CONFLICT (id) DO NOTHING;

-- ── category → field assignments (all product-level) ──────────────────────
INSERT INTO catalog_category_field_assignments (category_id, field_id, applies_to, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order) VALUES
('de400000-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','product',true,true,false,true,1),
('de400000-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','product',true,true,true,true,2),
('de400000-0000-0000-0000-000000000001','de4f0003-0000-0000-0000-000000000001','product',true,true,false,false,3),
('de400000-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','product',true,true,false,false,4),
('de400000-0000-0000-0000-000000000001','de4f0005-0000-0000-0000-000000000001','product',true,true,false,false,5),
('de400000-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','product',true,true,false,false,6),
('de400000-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','product',true,true,false,false,7),
('de400000-0000-0000-0000-000000000001','de4f0008-0000-0000-0000-000000000001','product',false,true,false,false,8),
('de400000-0000-0000-0000-000000000001','de4f0009-0000-0000-0000-000000000001','product',false,true,false,false,9),
('de400000-0000-0000-0000-000000000001','de4f0010-0000-0000-0000-000000000001','product',false,true,false,false,10),
('de400000-0000-0000-0000-000000000001','de4f0011-0000-0000-0000-000000000001','product',false,true,false,false,11),
('de400000-0000-0000-0000-000000000001','de4f0012-0000-0000-0000-000000000001','product',true,true,false,false,12),
('de400000-0000-0000-0000-000000000001','de4f0013-0000-0000-0000-000000000001','product',true,true,false,false,13),
('de400000-0000-0000-0000-000000000001','de4f0014-0000-0000-0000-000000000001','product',false,true,false,false,14),
('de400000-0000-0000-0000-000000000001','de4f0015-0000-0000-0000-000000000001','product',false,true,false,false,15),
('de400000-0000-0000-0000-000000000001','de4f0016-0000-0000-0000-000000000001','product',false,true,false,false,16)
ON CONFLICT (category_id, field_id) DO NOTHING;

-- ── product ───────────────────────────────────────────────────────────────
INSERT INTO catalog_products (id, category_id, slug, name, description, is_active, sort_order, base_price_eur_cents, visible_agents, visible_internal) VALUES
('de400001-0000-0000-0000-000000000001','de400000-0000-0000-0000-000000000001','demo-glulam-gl28h-spruce','[DEMO] Glulam Beam GL28h Spruce','Made-up demo glulam beam with a full spec sheet and attached datasheet + CAD drawing. Cut-to-order cross sections; see variants for sizes/prices.',true,0,42000,true,true)
ON CONFLICT (id) DO NOTHING;

-- ── product field values (16 — one per field) ─────────────────────────────
INSERT INTO catalog_product_field_values (id, product_id, field_id, option_id, value_text, value_number, value_storage_path, value_file_name, value_mime_type, value_file_size_bytes) VALUES
('de4d0001-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0001-0000-0000-0000-000000000001','de4c0101-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0002-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0002-0000-0000-0000-000000000001','de4c0202-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0003-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0003-0000-0000-0000-000000000001','de4c0301-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0004-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0004-0000-0000-0000-000000000001','de4c0401-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0005-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0005-0000-0000-0000-000000000001','de4c0502-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0006-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0006-0000-0000-0000-000000000001','de4c0602-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0007-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0007-0000-0000-0000-000000000001','de4c0702-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,NULL,NULL),
('de4d0008-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0008-0000-0000-0000-000000000001',NULL,NULL,12,NULL,NULL,NULL,NULL),
('de4d0009-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0009-0000-0000-0000-000000000001',NULL,NULL,470,NULL,NULL,NULL,NULL),
('de4d0010-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0010-0000-0000-0000-000000000001',NULL,NULL,40,NULL,NULL,NULL,NULL),
('de4d0011-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0011-0000-0000-0000-000000000001',NULL,NULL,15,NULL,NULL,NULL,NULL),
('de4d0012-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0012-0000-0000-0000-000000000001',NULL,'true',NULL,NULL,NULL,NULL,NULL),
('de4d0013-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0013-0000-0000-0000-000000000001',NULL,'true',NULL,NULL,NULL,NULL,NULL),
('de4d0014-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0014-0000-0000-0000-000000000001',NULL,NULL,NULL,'demo-glulam/de400001-0000-0000-0000-000000000001/GL28h-datasheet.txt','GL28h-datasheet.txt','text/plain',381),
('de4d0015-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0015-0000-0000-0000-000000000001',NULL,NULL,NULL,'demo-glulam/de400001-0000-0000-0000-000000000001/GL28h-section.png','GL28h-section.png','image/png',70),
('de4d0016-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','de4f0016-0000-0000-0000-000000000001',NULL,'Made-up demo beam for UI testing. Camber pre-set to 15 mm; cross-sections cut to order per the variants below.',NULL,NULL,NULL,NULL,NULL)
ON CONFLICT (id) DO NOTHING;

-- ── variants (cut-to-order cross sections) ────────────────────────────────
INSERT INTO catalog_variants (id, product_id, sku, thickness_mm, width_mm, length_mm, is_active, sort_order, price_eur_cents, stock_quantity, stock_unit) VALUES
('de4e0001-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','DEMO-GL-90x200',90,200,6000,true,0,42000,20,'piece'),
('de4e0002-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','DEMO-GL-115x300',115,300,12000,true,1,98000,10,'piece'),
('de4e0003-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','DEMO-GL-140x400',140,400,13500,true,2,165000,6,'piece')
ON CONFLICT (id) DO NOTHING;
