"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button } from "@timber/ui";
import { useConsent } from "@/lib/analytics/useConsent";

export function CookieConsentBanner() {
  const t = useTranslations("cookies");
  const locale = useLocale();
  const { isPending, isLoaded, acceptConsent, rejectConsent } = useConsent();

  // Don't render anything until we've loaded the consent state
  // This prevents flash of banner for users who already consented
  if (!isLoaded || !isPending) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-charcoal font-medium mb-1">
            {t("title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("description")}{" "}
            <a
              href={`/${locale}/privacy`}
              className="text-forest-green hover:underline"
            >
              {t("privacyLink")}
            </a>
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={rejectConsent}
          >
            {t("reject")}
          </Button>
          <Button
            size="sm"
            onClick={acceptConsent}
            className="bg-forest-green hover:bg-forest-green/90 text-white"
          >
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
