import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getCategory } from "@/features/catalog/actions/categories";
import { getCategoryFields } from "@/features/catalog/actions/fields";
import { getProduct } from "@/features/catalog/actions/products";
import { getVariants } from "@/features/catalog/actions/variants";
import { getPricingUnits } from "@/features/catalog/actions/pricingUnits";
import { getCurrencies, getCatalogCurrencyPrices } from "@/features/catalog/actions/currencies";
import { getVariantStock } from "@/features/catalog/actions/stock";
import { getVariantPackaging } from "@/features/catalog/actions/packaging";
import { getPackagingTypes } from "@/features/catalog/actions/packagingTypes";
import { VariantDetailPage } from "@/features/catalog/components/VariantDetailPage";

export const metadata: Metadata = { title: "Variant Detail" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string; variantId: string }>;
}

export default async function VariantPage({ params }: Props) {
  const { categoryId, productId, variantId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) redirect("/dashboard");
  }

  const [catResult, fieldsResult, productResult, variantsResult, unitsResult] = await Promise.all([
    getCategory(categoryId),
    getCategoryFields(categoryId),
    getProduct(productId),
    getVariants(productId),
    getPricingUnits(),
  ]);

  if (!catResult.success || !productResult.success) notFound();

  const variant = variantsResult.success
    ? variantsResult.data.find((v: any) => v.id === variantId)
    : null;

  if (!variant) notFound();

  const allFields = fieldsResult.success ? fieldsResult.data : [];
  const variantFields = allFields.filter((f: any) => f.appliesTo === "variant");
  const units = unitsResult.success ? unitsResult.data : [];
  const unit = units.find((u) => u.code === catResult.data.primaryUnit) ?? null;

  // Load stock + packaging server-side (same proven pattern as the data above)
  // rather than via mount-time server actions in the client cards. The old
  // client-mount round-trips were the P0 crash surface (9xcebr): a rejection
  // there surfaced as a masked "Server Components render" error and broke the
  // page. Server-fetched initial data means the cards render with data and no
  // mount RPC is needed. (`getVariantStock`/etc. can't reject — hardened.)
  const [currenciesResult, pricesResult, stockResult, packagingResult, packagingTypesResult] = await Promise.all([
    getCurrencies(),
    getCatalogCurrencyPrices([variantId, productId, categoryId]),
    getVariantStock(variantId),
    getVariantPackaging(variantId),
    getPackagingTypes(),
  ]);
  const altCurrencies = (currenciesResult.success ? currenciesResult.data : []).filter((c) => !c.isBase && c.isActive);

  const initialStock = stockResult.success ? stockResult.data : null;
  const initialPackaging = packagingResult.success ? packagingResult.data : [];
  const initialPackagingTypes = packagingTypesResult.success ? packagingTypesResult.data : [];
  // Per-card load error (inline-rendered, never fatal). Each card surfaces only
  // its OWN read failure — a packaging-read failure shows on the Packaging card,
  // not mislabeled on the Stock card (the Stock card just loses its add-options
  // and still shows its stock data). Packaging needs its list + the types.
  const stockError = !stockResult.success ? stockResult.error : null;
  const packagingError = !packagingResult.success ? packagingResult.error : (!packagingTypesResult.success ? packagingTypesResult.error : null);

  return (
    <VariantDetailPage
      variant={variant}
      categoryId={categoryId}
      productId={productId}
      productName={productResult.data.name}
      unit={unit}
      productBasePriceEurCents={productResult.data.basePriceEurCents}
      categoryDefaultPriceEurCents={catResult.data.defaultPriceEurCents}
      variantFields={variantFields}
      altCurrencies={altCurrencies}
      currencyPrices={pricesResult.success ? pricesResult.data : {}}
      initialStock={initialStock}
      initialPackaging={initialPackaging}
      initialPackagingTypes={initialPackagingTypes}
      stockError={stockError}
      packagingError={packagingError}
    />
  );
}
