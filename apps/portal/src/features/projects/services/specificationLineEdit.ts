export interface SpecificationLineEditInput {
  productName: string;
  unit: string;
  notes: string;
  quantityFields: { pieces: string | null; volume_m3: number | null };
}

export function specificationLineUpdate(
  isCatalogSnapshot: boolean,
  input: SpecificationLineEditInput,
): Record<string, unknown> {
  if (isCatalogSnapshot) {
    return { notes: input.notes || null, ...input.quantityFields };
  }
  return {
    product_name: input.productName,
    unit: input.unit,
    unit_price_cents: null,
    line_total_cents: null,
    notes: input.notes || null,
    catalog_product_id: null,
    catalog_variant_id: null,
    is_standard: false,
    ...input.quantityFields,
  };
}
