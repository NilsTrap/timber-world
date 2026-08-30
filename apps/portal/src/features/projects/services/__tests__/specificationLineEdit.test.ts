import { deepStrictEqual } from "node:assert";
import { specificationLineUpdate } from "../specificationLineEdit";

deepStrictEqual(
  specificationLineUpdate(true, {
    productName: "Attempted rename",
    unit: "piece",
    notes: "Updated note",
    quantityFields: { pieces: "12", volume_m3: null },
  }),
  { notes: "Updated note", pieces: "12", volume_m3: null },
  "catalogue edits expose only quantity and notes to the database update",
);

deepStrictEqual(
  specificationLineUpdate(false, {
    productName: "Custom assembly",
    unit: "piece",
    notes: "Shop drawing required",
    quantityFields: { pieces: "3", volume_m3: null },
  }),
  {
    product_name: "Custom assembly",
    unit: "piece",
    unit_price_cents: null,
    line_total_cents: null,
    notes: "Shop drawing required",
    catalog_product_id: null,
    catalog_variant_id: null,
    is_standard: false,
    pieces: "3",
    volume_m3: null,
  },
  "custom line editing retains its existing editable-field behavior",
);

console.log("specificationLineEdit.test.ts: passed");
