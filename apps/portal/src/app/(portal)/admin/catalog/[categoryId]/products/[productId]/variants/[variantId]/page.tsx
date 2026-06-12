import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getCategory } from "@/features/catalog/actions/categories";
import { getCategoryFields } from "@/features/catalog/actions/fields";
import { getProduct } from "@/features/catalog/actions/products";
import { getVariants } from "@/features/catalog/actions/variants";
import { getPricingUnits } from "@/features/catalog/actions/pricingUnits";
import { getCurrencies, getCatalogCurrencyPrices } from "@/features/catalog/actions/currencies";
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

  const [currenciesResult, pricesResult] = await Promise.all([
    getCurrencies(),
    getCatalogCurrencyPrices([variantId, productId, categoryId]),
  ]);
  const altCurrencies = (currenciesResult.success ? currenciesResult.data : []).filter((c) => !c.isBase && c.isActive);

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
    />
  );
}
