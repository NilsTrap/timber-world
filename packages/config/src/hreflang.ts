import { locales, defaultLocale, type Locale } from "./i18n";
import { siteConfig } from "./site";

// Regex pattern to strip leading locale from pathname
const LOCALE_PREFIX_PATTERN = new RegExp(`^\\/(${locales.join("|")})`);

/**
 * Strips the locale prefix from a pathname if present.
 */
function cleanPathname(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_PATTERN, "") || "/";
}

/**
 * Generates hreflang alternate links for a given pathname.
 * Used for SEO to indicate page translations to search engines.
 */
export function generateAlternateLinks(pathname: string) {
  const baseUrl = siteConfig.url;
  const cleanPath = cleanPathname(pathname);

  const languages: Record<string, string> = {};

  locales.forEach((locale) => {
    // For default locale, use root path (no prefix) per localePrefix: 'as-needed'
    if (locale === defaultLocale) {
      languages[locale] = `${baseUrl}${cleanPath === "/" ? "" : cleanPath}`;
    } else {
      languages[locale] = `${baseUrl}/${locale}${cleanPath === "/" ? "" : cleanPath}`;
    }
  });

  // Add x-default pointing to the default locale (non-null assertion safe - key was just set above)
  languages["x-default"] = languages[defaultLocale]!;

  return { languages };
}

/**
 * Generates canonical URL for a given pathname and locale.
 */
export function generateCanonical(pathname: string, locale: Locale) {
  const baseUrl = siteConfig.url;
  const cleanPath = cleanPathname(pathname);

  if (locale === defaultLocale) {
    return `${baseUrl}${cleanPath === "/" ? "" : cleanPath}`;
  }

  return `${baseUrl}/${locale}${cleanPath === "/" ? "" : cleanPath}`;
}
