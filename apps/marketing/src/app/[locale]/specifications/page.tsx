import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@timber/config/site";
import { type Locale } from "@timber/config/i18n";
import { generateAlternateLinks, generateCanonical } from "@timber/config/hreflang";
import { getCMSSpecifications } from "@/lib/actions/cms-specifications";
import { FileText, Download } from "lucide-react";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "specifications" });
  const alternates = generateAlternateLinks("/specifications");
  const canonical = generateCanonical("/specifications", locale as Locale);

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

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export default async function SpecificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "specifications" });
  const specs = await getCMSSpecifications();

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

      {/* Specifications Grid */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          {specs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">{t("noSpecs")}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {specs.map((spec) => (
                <div
                  key={spec.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="p-6">
                    <h2 className="font-heading text-2xl font-semibold text-charcoal mb-1">
                      {spec.title}
                    </h2>
                    {spec.description && (
                      <p className="text-gray-600 mb-4">{spec.description}</p>
                    )}

                    {/* Image gallery */}
                    {spec.files.some((f) => isImage(f.mimeType)) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                        {spec.files
                          .filter((f) => isImage(f.mimeType))
                          .map((file) => (
                            <a
                              key={file.id}
                              href={file.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square relative rounded-md overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={file.publicUrl}
                                alt={file.originalName}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                      </div>
                    )}

                    {/* PDF / document files */}
                    {spec.files.some((f) => !isImage(f.mimeType)) && (
                      <div className="space-y-2">
                        {spec.files
                          .filter((f) => !isImage(f.mimeType))
                          .map((file) => (
                            <a
                              key={file.id}
                              href={file.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                            >
                              <FileText className="h-5 w-5 text-gray-400 group-hover:text-charcoal shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-charcoal truncate">
                                  {file.originalName}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatFileSize(file.fileSizeBytes)}
                                  {file.mimeType === "application/pdf" ? " · PDF" : ""}
                                </p>
                              </div>
                              <Download className="h-4 w-4 text-gray-400 group-hover:text-charcoal shrink-0" />
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
