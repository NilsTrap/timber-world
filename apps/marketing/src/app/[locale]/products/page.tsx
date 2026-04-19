import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@timber/config/site";
import { type Locale } from "@timber/config/i18n";
import { generateAlternateLinks, generateCanonical } from "@timber/config/hreflang";
import { getCMSProducts } from "@/lib/actions/cms-products";
import { ProductCard } from "@/components/features/products/ProductCard";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "products" });
  const alternates = generateAlternateLinks("/products");
  const canonical = generateCanonical("/products", locale as Locale);

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: `${t("title")} | ${siteConfig.name}`,
      description: t("description"),
      type: "website",
    },
  };
}

export default async function ProductsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "products" });
  const products = await getCMSProducts();

  return (
    <div className="bg-warm-cream min-h-screen">
      {/* Header Section */}
      <section className="bg-charcoal text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl mb-4">
            {t("title")}
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto">
            {t("description")}
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {t("noProducts")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.key}
                  productKey={product.key}
                  title={product.title}
                  description={product.description}
                  imageUrl={product.imageUrl}
                  altText={product.altText}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
