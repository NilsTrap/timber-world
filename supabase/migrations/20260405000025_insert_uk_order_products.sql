-- Insert inventory_packages (products) for UK stair orders
-- Based on PDF analysis: 12 HIGH confidence + 4 MEDIUM confidence orders
-- Package numbers 11-47 (existing DDC max is 10)

INSERT INTO inventory_packages (
  package_number, product_name_id, wood_species_id, type_id, quality_id,
  thickness, width, length, pieces, volume_m3, volume_is_calculated,
  status, organisation_id, order_id, staircase_code_id, riser, unit_price_piece
) VALUES

-- ============ HIGH CONFIDENCE (12 orders) ============

-- P04201 (FJ110): 17 treads × £100, 9 winders × £230
('11', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '17', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '8393c789-6aed-4507-978d-af6bfcea4e73', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 100),
('12', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1200', '9',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '8393c789-6aed-4507-978d-af6bfcea4e73', 'e58c1f75-622b-41db-8670-1758299baf5c', '200', 230),

-- P04199-GF (FS22): 13 treads × £55, 2 winders × £90, 2 quarters × £150
('13', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '13', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '4aa6dba9-093d-446c-954e-db4da50699b6', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 55),
('14', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '4aa6dba9-093d-446c-954e-db4da50699b6', '4c1e1492-4f55-4e28-9869-c3e4c8c568a3', '200', 90),
('15', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '4aa6dba9-093d-446c-954e-db4da50699b6', 'a14c3cad-5ce7-4fdf-b841-d7639c26ab30', '200', 150),

-- P04199-FF (FS22): 10 treads × £55, 7 winders × £90, 1 quarter × £150
('16', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '10', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'b8787671-c4db-4723-83f6-6f4e3ca2181e', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 55),
('17', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '7',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'b8787671-c4db-4723-83f6-6f4e3ca2181e', '4c1e1492-4f55-4e28-9869-c3e4c8c568a3', '200', 90),
('18', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'b8787671-c4db-4723-83f6-6f4e3ca2181e', 'a14c3cad-5ce7-4fdf-b841-d7639c26ab30', '200', 150),

-- P04105 (FS22): 32 treads × £45 (old price)
('19', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '32', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '2a42262f-05a1-45f6-9501-2ca05e827f88', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 45),

-- P04107 (FS22): 14 treads × £45 (old), 3 quarters × £140 (old)
('20', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '14', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'd16916d6-ca58-4976-a993-1324b919565c', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 45),
('21', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '3',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'd16916d6-ca58-4976-a993-1324b919565c', 'a14c3cad-5ce7-4fdf-b841-d7639c26ab30', '200', 140),

-- P04075 (FJ110): 11 treads × £90 (old)
('22', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '11', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '530eed37-5dc4-4589-8372-20ae81ad4eba', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 90),

-- P00629 (FJ110): 12 treads × £90 (old)
('23', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '12', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'b8f75f02-c3b7-4d11-86ad-0737a27a386a', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 90),

-- P00652 (FJ110): 9 treads × £100, 3 winders × £200
('24', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '9',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'c4004b33-a27a-4c5f-ba89-f30091425e12', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 100),
('25', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '3',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'c4004b33-a27a-4c5f-ba89-f30091425e12', 'c957a010-d542-4db3-8f46-2ee2216f1efd', '200', 200),

-- P04058 (FS22): 59 winders × £100 (old), 4 quarters × £140 (old)
('26', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '59', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'fbd51f01-55cf-4c66-bf9f-134b665d097b', 'e43f6b54-d9dc-434e-b117-55951286da32', '200', 100),
('27', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '4',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'fbd51f01-55cf-4c66-bf9f-134b665d097b', 'a14c3cad-5ce7-4fdf-b841-d7639c26ab30', '200', 140),

-- P04054 (FJ110): 13 treads × £90 (old), 1 quarter × £360 (old)
('28', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '13', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'da655d5a-36e7-4538-b82b-0101b2f2a6e7', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 90),
('29', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1200', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'da655d5a-36e7-4538-b82b-0101b2f2a6e7', '5c163fdf-fa8d-4965-90a5-e646cc49628c', '200', 360),

-- P04155 (FJ110): 15 treads × £100, 7 winders × £200 (1000mm) + 1 winder × £230 (1200mm)
('30', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '15', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '94d1f508-529a-4f2e-bf2d-b0837d6a48cb', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 100),
('31', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '7',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '94d1f508-529a-4f2e-bf2d-b0837d6a48cb', 'c957a010-d542-4db3-8f46-2ee2216f1efd', '200', 200),
('32', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1200', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '94d1f508-529a-4f2e-bf2d-b0837d6a48cb', 'e58c1f75-622b-41db-8670-1758299baf5c', '200', 230),

-- P00631 (FJ110): 8 treads × £100, 3 winders × £190 (old)
('33', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '8',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'f908d55c-41ee-413f-884a-523f77b88c07', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 100),
('34', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '3',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'f908d55c-41ee-413f-884a-523f77b88c07', 'c957a010-d542-4db3-8f46-2ee2216f1efd', '200', 190),

-- ============ MEDIUM CONFIDENCE (4 orders) ============

-- P04199-SF (FS22): 5 treads × £55, 4 winders × £110 (1200mm) + 2 winders × £90 (1000mm)
('35', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '5',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'ebf3fb7b-5b22-466d-89ec-709ae2b93623', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 55),
('36', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '4',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'ebf3fb7b-5b22-466d-89ec-709ae2b93623', 'e43f6b54-d9dc-434e-b117-55951286da32', '200', 110),
('37', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'ebf3fb7b-5b22-466d-89ec-709ae2b93623', '4c1e1492-4f55-4e28-9869-c3e4c8c568a3', '200', 90),

-- P04149 (FS22): 9 treads × £55, 1 winder × £90 (1000mm) + 2 winders × £110 (1200mm)
('38', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '9',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '9e1aa9a5-01c7-4c4b-be40-469dcb12efb2', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 55),
('39', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '9e1aa9a5-01c7-4c4b-be40-469dcb12efb2', '4c1e1492-4f55-4e28-9869-c3e4c8c568a3', '200', 90),
('40', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '9e1aa9a5-01c7-4c4b-be40-469dcb12efb2', 'e43f6b54-d9dc-434e-b117-55951286da32', '200', 110),

-- P00649 (FJ110): 10 treads × £100, 2 winders × £200 (1000mm) + 1 winder × £280 (1400mm)
('41', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '10', NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '50c0769e-d6aa-48bd-9c82-35ae707dc79a', '22e03823-3b9b-4841-9cd4-1a12edeb0cd8', '200', 100),
('42', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1000', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '50c0769e-d6aa-48bd-9c82-35ae707dc79a', 'c957a010-d542-4db3-8f46-2ee2216f1efd', '200', 200),
('43', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '40', '280', '1400', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '50c0769e-d6aa-48bd-9c82-35ae707dc79a', 'a4c24142-99f1-4887-b07d-eddf34c3cf5f', '200', 280),

-- P04150 (FS22): 7 treads × £55, 2 winders × £90 (1000mm) + 1 winder × £110 (1200mm), 1 quarter × £150
('44', '730ba2b9-d83a-4843-b05e-15084fa676f0', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '7',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'a4ffe798-962b-4327-930e-fc1d071f74c8', 'eabf4601-ba2b-499d-8387-ac655d6b2500', '200', 55),
('45', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1000', '2',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'a4ffe798-962b-4327-930e-fc1d071f74c8', '4c1e1492-4f55-4e28-9869-c3e4c8c568a3', '200', 90),
('46', 'bc15ee25-3379-44b0-99a9-8e222697280a', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'a4ffe798-962b-4327-930e-fc1d071f74c8', 'e43f6b54-d9dc-434e-b117-55951286da32', '200', 110),
('47', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', 'f76816b0-0fd5-4bf4-bba0-021116f156fd', '8e1b7831-9ab6-4e32-9755-6651607b63f9', '1f8c12b7-adbc-4ed9-b9fc-2161b108687f',
 '22', '280', '1200', '1',  NULL, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', 'a4ffe798-962b-4327-930e-fc1d071f74c8', 'a14c3cad-5ce7-4fdf-b841-d7639c26ab30', '200', 150);
