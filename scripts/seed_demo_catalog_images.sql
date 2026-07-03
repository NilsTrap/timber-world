-- DEMO catalog images (product + variant) — throwaway placeholder photos so we can
-- see how images render (incl. the new variant-row thumbnail). The image FILES are
-- generated placeholder PNGs uploaded to the PUBLIC `catalog` bucket under
-- products/<productId>/ and variants/<variantId>/ (see the seeding notes); this file
-- only inserts the DB rows that point at them (alt_text '[DEMO] image').
-- CLEANUP (rows; also delete the objects from the catalog bucket):
--   delete from catalog_product_images where alt_text='[DEMO] image';
--   delete from catalog_variant_images where alt_text='[DEMO] image';

insert into catalog_product_images (id,product_id,storage_path,alt_text,is_primary,sort_order) values
 ('dea10001-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','products/de400001-0000-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea10002-0000-0000-0000-000000000001','de400001-0000-0000-0000-000000000001','products/de400001-0000-0000-0000-000000000001/demo-img-2.png','[DEMO] image',false,1),
 ('dea10003-0000-0000-0000-000000000001','de300001-0001-0000-0000-000000000001','products/de300001-0001-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea10004-0000-0000-0000-000000000001','de300001-0003-0000-0000-000000000001','products/de300001-0003-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea10005-0000-0000-0000-000000000001','de300001-0005-0000-0000-000000000001','products/de300001-0005-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0)
on conflict (id) do nothing;

insert into catalog_variant_images (id,variant_id,storage_path,alt_text,is_primary,sort_order) values
 ('dea20001-0000-0000-0000-000000000001','de4e0001-0000-0000-0000-000000000001','variants/de4e0001-0000-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea20002-0000-0000-0000-000000000001','de4e0002-0000-0000-0000-000000000001','variants/de4e0002-0000-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea20003-0000-0000-0000-000000000001','de4e0003-0000-0000-0000-000000000001','variants/de4e0003-0000-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea20004-0000-0000-0000-000000000001','de300002-0001-0000-0000-000000000001','variants/de300002-0001-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0),
 ('dea20005-0000-0000-0000-000000000001','de300002-0004-0000-0000-000000000001','variants/de300002-0004-0000-0000-000000000001/demo-img-1.png','[DEMO] image',true,0)
on conflict (id) do nothing;

-- Variant-level field demo (answers "how are variant fields configured?"): a field
-- assigned to the category with applies_to='variant' shows up in the variant form.
insert into catalog_fields (id, field_key, field_label, field_type, unit, is_system) values
 ('de4f0017-0000-0000-0000-000000000001','demo_grade','Grade','select',null,false) on conflict (id) do nothing;
insert into catalog_field_options (id, field_id, value, label, sort_order, is_active) values
 ('de4c1701-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','a','A - Prime',0,true),
 ('de4c1702-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','b','B - Standard',1,true),
 ('de4c1703-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','c','C - Utility',2,true) on conflict (id) do nothing;
insert into catalog_category_field_assignments (category_id, field_id, applies_to, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order) values
 ('de400000-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','variant',true,true,false,false,17) on conflict (category_id, field_id) do nothing;
insert into catalog_variant_field_values (id, variant_id, field_id, option_id) values
 ('de4d1701-0000-0000-0000-000000000001','de4e0001-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','de4c1701-0000-0000-0000-000000000001'),
 ('de4d1702-0000-0000-0000-000000000001','de4e0002-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','de4c1702-0000-0000-0000-000000000001'),
 ('de4d1703-0000-0000-0000-000000000001','de4e0003-0000-0000-0000-000000000001','de4f0017-0000-0000-0000-000000000001','de4c1703-0000-0000-0000-000000000001') on conflict (id) do nothing;
