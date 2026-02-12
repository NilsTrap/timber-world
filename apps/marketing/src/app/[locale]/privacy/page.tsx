"use client";

import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-charcoal mb-8">{t("title")}</h1>

        <div className="prose prose-slate max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <p className="text-muted-foreground">{t("intro")}</p>
          </section>

          {/* What we collect */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("collectTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">{t("collectIntro")}</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>{t("collectItem1")}</li>
              <li>{t("collectItem2")}</li>
              <li>{t("collectItem3")}</li>
              <li>{t("collectItem4")}</li>
            </ul>
          </section>

          {/* What we don't collect */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("notCollectTitle")}
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>{t("notCollectItem1")}</li>
              <li>{t("notCollectItem2")}</li>
              <li>{t("notCollectItem3")}</li>
              <li>{t("notCollectItem4")}</li>
            </ul>
          </section>

          {/* How we use data */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("useTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">{t("useIntro")}</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>{t("useItem1")}</li>
              <li>{t("useItem2")}</li>
              <li>{t("useItem3")}</li>
            </ul>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("cookiesTitle")}
            </h2>
            <p className="text-muted-foreground">{t("cookiesText")}</p>
          </section>

          {/* Your choices */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("choicesTitle")}
            </h2>
            <p className="text-muted-foreground">{t("choicesText")}</p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              {t("contactTitle")}
            </h2>
            <p className="text-muted-foreground">{t("contactText")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
