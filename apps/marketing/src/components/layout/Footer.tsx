"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { siteConfig } from "@timber/config/site";

export function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-warm-cream" role="contentinfo">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-block font-heading text-2xl font-semibold"
            >
              {siteConfig.name}
            </Link>
            <p className="mt-4 max-w-md text-warm-cream/80">
              {t("footer.companyDescription")}
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="font-heading text-lg font-semibold">
              {t("footer.navigation")}
            </h3>
            <nav aria-label="Footer navigation" className="mt-4">
              <ul className="space-y-3">
                {siteConfig.navigation.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-warm-cream/80 transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                    >
                      {t(`nav.${item.key}`)}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/quote"
                    className="text-warm-cream/80 transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                  >
                    {t("nav.requestQuote")}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-heading text-lg font-semibold">
              {t("footer.contactSection")}
            </h3>
            <address className="mt-4 not-italic space-y-3 text-warm-cream/80">
              <p>{siteConfig.name}</p>
              <p>
                <a
                  href="mailto:info@timber-international.com"
                  className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                >
                  info@timber-international.com
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-warm-cream/20 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-warm-cream/60">
              {t("footer.copyright", { year: currentYear })}
            </p>
            <div className="flex gap-6 text-sm text-warm-cream/60">
              <Link
                href="/privacy"
                className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
              >
                {t("footer.privacy")}
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
              >
                {t("footer.terms")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
