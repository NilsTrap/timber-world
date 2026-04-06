-- Import 27 stair production UK orders from PDF "Stair production UK - DB Import"
-- Customer = organisation_id (buyer), all status = draft
-- Deal nr column is skipped per user request

-- Advance the sequence past existing orders (ORD-001, ORD-002 already exist)
SELECT setval('order_number_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'ORD-(\d+)') AS INTEGER)), 0) FROM orders),
  (SELECT last_value FROM order_number_seq)
));

INSERT INTO orders (
  id, code, name, project_number, organisation_id, date_received, date_loaded,
  tread_length, advance_invoice_number, package_number, transport_invoice_number, transport_price,
  status, currency, created_by
) VALUES
-- Row 1: Ovoms, 02.04.2026, P00659, 0V02091-FF
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00659', '0V02091-FF',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-04-02', NULL,
 NULL, 'AV0182', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 2: Ovoms, 02.04.2026, P00659, 0V02091-GF
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00659', '0V02091-GF',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-04-02', NULL,
 NULL, 'AV0182', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 3: DDC, 02.04.2026, P04201, S03419
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04201', 'S03419',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-04-02', NULL,
 NULL, 'AV0181', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 4: DDC, 01.04.2026, P04202, S04313, tread 917
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04202', 'S04313',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-04-01', NULL,
 '917', 'AV0180', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 5: DDC, 01.04.2026, P04199, S04249 - GF, tread 855
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04199', 'S04249 - GF',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-04-01', NULL,
 '855', 'AV0179', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 6: DDC, 01.04.2026, P04199, S04249 - FF, tread 855
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04199', 'S04249 - FF',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-04-01', NULL,
 '855', 'AV0179', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 7: DDC, 01.04.2026, P04199, S04249 - SF, tread 855
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04199', 'S04249 - SF',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-04-01', NULL,
 '855', 'AV0179', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 8: DDC, 24.03.2026, loaded 02.04.2026, P04171, S03243, tread 1050
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04171', 'S03243',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-24', '2026-04-02',
 '1050', 'AV0174', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 9: DDC, 19.03.2026, loaded 02.04.2026, P04150, S04078, tread 940
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04150', 'S04078',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-19', '2026-04-02',
 '940', 'AV0172', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 10: DDC, 19.03.2026, loaded 02.04.2026, P04149, S04259, tread 886
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04149', 'S04259',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-19', '2026-04-02',
 '886', 'AV0171', NULL, NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 11: Ovoms, 25.03.2026, loaded 02.04.2026, P00652, 0V00395, tread 940, pkg TWG05250
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00652', '0V00395',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-03-25', '2026-04-02',
 '940', 'AV0176', 'TWG05250', NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 12: Ovoms, 25.03.2026, loaded 02.04.2026, P00649, 0V01478, tread 830, pkg TWG05250
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00649', '0V01478',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-03-25', '2026-04-02',
 '830', 'AV0175', 'TWG05250', NULL, NULL,
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 13: DDC, 20.03.2026, loaded 27.03.2026, P04155, S04572, tread 720/830, pkg TWG05248
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04155', 'S04572',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-20', '2026-03-27',
 '720/830', 'AV0173', 'TWG05248', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 14: DDC, 12.03.2026, loaded 27.03.2026, P04105, S04333 - GUSTAVO, tread 884, pkg TWG05247
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04105', 'S04333 - GUSTAVO',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-12', '2026-03-27',
 '884', 'AV0168', 'TWG05247', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 15: DDC, 12.03.2026, loaded 27.03.2026, P04107, S04549, tread 950, pkg TWG05248
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04107', 'S04549',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-12', '2026-03-27',
 '950', 'AV0167', 'TWG05248', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Rows 16-19: DDC, 06.03.2026, loaded 27.03.2026, P04096, S04163, tread 1496, pkg TWG05249 (4 rows)
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04096', 'S04163',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-06', '2026-03-27',
 '1496', 'AV0169', 'TWG05249', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04096', 'S04163',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-06', '2026-03-27',
 '1496', 'AV0169', 'TWG05249', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04096', 'S04163',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-06', '2026-03-27',
 '1496', 'AV0169', 'TWG05249', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04096', 'S04163',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-06', '2026-03-27',
 '1496', 'AV0169', 'TWG05249', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 20: Ovoms, 05.03.2026, loaded 27.03.2026, P00639, 0V01262, tread 995, pkg TWG05247
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00639', '0V01262',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-03-05', '2026-03-27',
 '995', 'AV0165', 'TWG05247', '443558', '123.75',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 21: DDC, 02.03.2026, loaded 13.03.2026, P04075, S03674, tread 800, pkg TWG05246
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04075', 'S03674',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-03-02', '2026-03-13',
 '800', 'AV0164', 'TWG05246', '442975', '200',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 22: Ovoms, 26.02.2026, loaded 06.03.2026, P00631, 0V01953, tread 910, pkg TWG05244
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00631', '0V01953',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-02-26', '2026-03-06',
 '910', 'AV0163', 'TWG05244', '21369', '158',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 23: DDC, 26.02.2026, loaded 13.03.2026, P04058, S03662, no tread, pkg TWG05246
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04058', 'S03662',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-02-26', '2026-03-13',
 NULL, 'AV0162', 'TWG05246', '442975', '200',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 24: Ovoms, 26.02.2026, loaded 06.03.2026, P00629, 0V01941, tread 860, pkg TWG05244
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00629', '0V01941',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-02-26', '2026-03-06',
 '860', 'AV0161', 'TWG05244', '21369', '158',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 25: DDC, 25.02.2026, loaded 06.03.2026, P04054, S03856, tread 900, pkg TWG05245
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04054', 'S03856',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-02-25', '2026-03-06',
 '900', 'AV0160', 'TWG05245', '21369', '158',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 26: Ovoms, 19.02.2026, loaded 06.03.2026, P00621, 0V01327, tread 1070-1532, pkg TWG05244
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P00621', '0V01327',
 'eb8f72e1-468e-44ee-b819-f0d9fe239783', '2026-02-19', '2026-03-06',
 '1070-1532', 'AV0159', 'TWG05244', '21369', '158',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95'),

-- Row 27: DDC, 18.02.2026, loaded 06.03.2026, P04036, S02905, tread 1075/1200, pkg TWG05245
(gen_random_uuid(), 'ORD-' || LPAD(nextval('order_number_seq')::text, 3, '0'), 'P04036', 'S02905',
 '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2026-02-18', '2026-03-06',
 '1075/1200', 'AV0156', 'TWG05245', '21369', '158',
 'draft', 'EUR', 'c10efee0-e4fb-4e45-8f17-977540a45b95');
