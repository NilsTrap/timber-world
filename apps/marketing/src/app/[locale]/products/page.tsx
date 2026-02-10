import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@timber/config/site";
import { type Locale } from "@timber/config/i18n";
import { generateAlternateLinks, generateCanonical } from "@timber/config/hreflang";
import { ProductCatalog } from "@/components/features/catalog";
import { getProducts, getFilterOptions } from "@/lib/actions/products";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const alternates = generateAlternateLinks("/products");
  const canonical = generateCanonical("/products", locale as Locale);

  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: `${t("title")} | ${siteConfig.name}`,
      description: t("subtitle"),
      type: "website",
    },
  };
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  // Parse search params for initial data fetch
  const filters = {
    product: parseArrayParam(search.product),
    species: parseArrayParam(search.species),
    width: parseArrayParam(search.width),
    length: parseArrayParam(search.length),
    thickness: parseArrayParam(search.thickness),
    qualityGrade: parseArrayParam(search.qualityGrade),
    type: parseArrayParam(search.type),
    humidity: parseArrayParam(search.humidity),
    processing: parseArrayParam(search.processing),
    fscCertified: search.fscCertified === "true" ? true : search.fscCertified === "false" ? false : undefined,
  };

  const page = typeof search.page === "string" ? parseInt(search.page, 10) || 1 : 1;
  const sortBy = typeof search.sortBy === "string" ? search.sortBy : undefined;
  const sortOrder = search.sortOrder === "desc" ? "desc" : "asc";

  // Fetch initial data on server
  const [productsResult, filterOptionsResult] = await Promise.all([
    getProducts(filters, page, sortBy, sortOrder as "asc" | "desc"),
    getFilterOptions(),
  ]);

  return (
    <div className="bg-warm-cream">
      <ProductCatalog
        initialProducts={productsResult.success ? productsResult.data : {
          products: [],
          total: 0,
          page: 1,
          pageSize: 20,
          filterOptions: filterOptionsResult.success ? filterOptionsResult.data : {
            products: [],
            species: [],
            widths: [],
            lengths: [],
            thicknesses: [],
            qualityGrades: [],
            types: [],
            humidities: [],
            processings: [],
          }
        }}
        initialFilters={filters}
        initialPage={page}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder as "asc" | "desc"}
        filterOptions={filterOptionsResult.success ? filterOptionsResult.data : {
          products: [],
          species: [],
          widths: [],
          lengths: [],
          thicknesses: [],
          qualityGrades: [],
          types: [],
          humidities: [],
          processings: [],
        }}
      />
    </div>
  );
}

function parseArrayParam(param: string | string[] | undefined): string[] {
  if (!param) return [];
  if (Array.isArray(param)) return param;
  return [param];
}
