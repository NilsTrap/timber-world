export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type PrimaryUnit = "m2" | "m3" | "piece" | "linear_m";
export type FieldType = "select" | "number" | "text" | "boolean";
export type AppliesTo = "product" | "variant";

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageStoragePath: string | null;
  primaryUnit: PrimaryUnit;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  fieldCount?: number;
  productCount?: number;
}

export interface CatalogField {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  unit: string | null;
  refTable: string | null;
  options?: FieldOption[];
}

export interface FieldAssignment {
  id: string;
  categoryId: string;
  fieldId: string;
  appliesTo: AppliesTo;
  showInFilter: boolean;
  showInDetail: boolean;
  showInPriceList: boolean;
  isRequired: boolean;
  sortOrder: number;
  field?: CatalogField;
}

/** Combined view used by components: field definition + per-category assignment settings */
export interface CategoryField {
  id: string;
  assignmentId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  unit: string | null;
  refTable: string | null;
  appliesTo: AppliesTo;
  showInFilter: boolean;
  showInDetail: boolean;
  showInPriceList: boolean;
  isRequired: boolean;
  sortOrder: number;
  options?: FieldOption[];
}

export interface FieldOption {
  id: string;
  fieldId: string;
  refValueId: string | null;
  value: string;
  label: string;
  description: string | null;
  descriptionImagePath: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  fieldValues?: ProductFieldValue[];
  images?: ProductImage[];
  variantCount?: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  storagePath: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductFieldValue {
  id: string;
  productId: string;
  fieldId: string;
  optionId: string | null;
  valueText: string | null;
  valueNumber: number | null;
  field?: CatalogField;
  option?: FieldOption;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  sku: string | null;
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
  lengthMinMm: number | null;
  lengthMaxMm: number | null;
  priceM2Cents: number | null;
  priceM3Cents: number | null;
  pricePieceCents: number | null;
  priceLinearMCents: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  fieldValues?: VariantFieldValue[];
  images?: VariantImage[];
}

export interface VariantImage {
  id: string;
  variantId: string;
  storagePath: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface VariantFieldValue {
  id: string;
  variantId: string;
  fieldId: string;
  optionId: string | null;
  valueText: string | null;
  valueNumber: number | null;
  field?: CatalogField;
  option?: FieldOption;
}

// ---- Input types for create/update ----

export interface SaveCategoryInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  primaryUnit: PrimaryUnit;
  isActive?: boolean;
  sortOrder?: number;
}

export interface SaveFieldInput {
  id?: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  unit?: string | null;
  refTable?: string | null;
}

export interface SaveFieldAssignmentInput {
  id?: string;
  categoryId: string;
  fieldId: string;
  appliesTo: AppliesTo;
  showInFilter?: boolean;
  showInDetail?: boolean;
  showInPriceList?: boolean;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface SaveFieldOptionInput {
  id?: string;
  fieldId: string;
  refValueId?: string | null;
  value: string;
  label: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SaveProductInput {
  id?: string;
  categoryId: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  fieldValues?: { fieldId: string; optionId?: string | null; valueText?: string | null; valueNumber?: number | null }[];
}

export interface SaveVariantInput {
  id?: string;
  productId: string;
  sku?: string | null;
  thicknessMm?: number | null;
  widthMm?: number | null;
  lengthMm?: number | null;
  lengthMinMm?: number | null;
  lengthMaxMm?: number | null;
  priceM2Cents?: number | null;
  priceM3Cents?: number | null;
  pricePieceCents?: number | null;
  priceLinearMCents?: number | null;
  currency?: string;
  isActive?: boolean;
  sortOrder?: number;
  fieldValues?: { fieldId: string; optionId?: string | null; valueText?: string | null; valueNumber?: number | null }[];
}
