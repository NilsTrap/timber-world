import type { CommissionConfig } from "./pricing";

export interface CartItem {
  id: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  packagingName: string | null;
  piecesPerPackage: number | null;
  baseQtyPerPackage: number | null;
  unitSymbol: string | null;
  unitPriceCents: number;
  quantityPackages: number;
  discountPct: number;
  lineSubtotalCents: number;
  lineTotalCents: number;
  commissionPct: number;
  commissionCents: number;
}

export interface CartOrder {
  id: string;
  code: string;
  status: string;
  customerName: string | null;
  customerCompany: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotalCents: number;
  discountTotalCents: number;
  totalCents: number;
  commissionTotalCents: number;
  submittedAt: string | null;
  createdAt: string;
  items: CartItem[];
}

export interface VariantOrderContext {
  productId: string;
  categoryId: string;
  productName: string;
  variantLabel: string;
  sku: string | null;
  packagingName: string;
  piecesPerPackage: number;
  baseQtyPerPackage: number;
  unitSymbol: string;
  gbpRateCents: number;
  packagePriceCents: number;
  commission: CommissionConfig;
  showCommissions: boolean;
  stockPackages: number | null;
  stockBaseQty: number | null;
}
