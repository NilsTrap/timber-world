import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@timber/config/site";
import { type Locale } from "@timber/config/i18n";
import { generateAlternateLinks, generateCanonical } from "@timber/config/hreflang";
import { QuoteForm } from "@/components/features/quote/QuoteForm";
import { Mail, Phone, MapPin } from "lucide-react";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quote" });
  const alternates = generateAlternateLinks("/quote");
  const canonical = generateCanonical("/quote", locale as Locale);

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

export default async function QuotePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "quote" });

  const preselectedProducts = typeof search.products === "string" ? search.products : undefined;

  return (
    <div className="bg-warm-cream min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-charcoal mb-2">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quote Form */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-background p-6">
              <QuoteForm preselectedProducts={preselectedProducts} />
            </div>
          </div>

          {/* Contact Information Card */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border bg-background p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-charcoal mb-4">{t("contactUs")}</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-charcoal">{siteConfig.name}</h3>
                </div>

                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="text-muted-foreground">
                    <p>Ulbrokas iela 19a</p>
                    <p>Rīga, LV-1021</p>
                    <p>Latvia</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href="mailto:info@timber-international.com"
                    className="text-forest-green hover:underline"
                  >
                    info@timber-international.com
                  </a>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href="tel:+37122002270"
                    className="text-forest-green hover:underline"
                  >
                    +371 2200 2270
                  </a>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <p className="text-xs text-muted-foreground">
                  {t("responseTime")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
