import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getCategory } from "@/features/catalog/actions/categories";
import { getCategoryFields } from "@/features/catalog/actions/fields";
import { getProduct } from "@/features/catalog/actions/products";
import { getVariants } from "@/features/catalog/actions/variants";
import { getPricingUnits } from "@/features/catalog/actions/pricingUnits";
import { getCurrencies, getCatalogCurrencyPrices } from "@/features/catalog/actions/currencies";
import { getPackagingTypes } from "@/features/catalog/actions/packagingTypes";
import { ProductDetailContent } from "@/features/catalog/components/ProductDetailContent";

export const metadata: Metadata = { title: "Product Detail" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { categoryId, productId } = await params;
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

  const allFields = fieldsResult.success ? fieldsResult.data : [];
  const productFields = allFields.filter((f: any) => f.appliesTo === "product");
  const variantFields = allFields.filter((f: any) => f.appliesTo === "variant");
  const units = unitsResult.success ? unitsResult.data : [];
  const unit = units.find((u) => u.code === catResult.data.primaryUnit) ?? null;
  const variants = variantsResult.success ? variantsResult.data : [];

  const [currenciesResult, pricesResult, packagingResult] = await Promise.all([
    getCurrencies(),
    getCatalogCurrencyPrices([categoryId, productId, ...variants.map((v) => v.id)]),
    getPackagingTypes(),
  ]);
  const altCurrencies = (currenciesResult.success ? currenciesResult.data : []).filter((c) => !c.isBase && c.isActive);
  const packagingTypes = (packagingResult.success ? packagingResult.data : []).filter((p) => p.isActive);

  return (
    <ProductDetailContent
      product={productResult.data}
      categoryId={categoryId}
      categoryName={catResult.data.name}
      unit={unit}
      categoryDefaultPriceEurCents={catResult.data.defaultPriceEurCents}
      productFields={productFields}
      variantFields={variantFields}
      variants={variants}
      altCurrencies={altCurrencies}
      currencyPrices={pricesResult.success ? pricesResult.data : {}}
      packagingTypes={packagingTypes}
    />
  );
}
