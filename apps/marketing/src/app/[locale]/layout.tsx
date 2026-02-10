import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale, getTranslations } from "next-intl/server";
import { locales, type Locale } from "@timber/config/i18n";
import { siteConfig } from "@timber/config/site";
import { generateAlternateLinks, generateCanonical } from "@timber/config/hreflang";
import { SkipLink } from "@/components/layout/SkipLink";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const alternates = generateAlternateLinks("/");
  const canonical = generateCanonical("/", locale as Locale);

  return {
    title: {
      default: t("title"),
      template: `%s | ${siteConfig.name}`,
    },
    description: t("description"),
    alternates: {
      canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      locale: locale,
      alternateLocale: locales.filter((l) => l !== locale),
      type: "website",
      siteName: siteConfig.name,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SkipLink />
      <Header />
      <main id="main-content" className="pt-20 md:pt-28">
        {children}
      </main>
      <ConditionalFooter />
    </NextIntlClientProvider>
  );
}
