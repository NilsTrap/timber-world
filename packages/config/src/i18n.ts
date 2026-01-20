export const locales = ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fi: 'Suomi',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  nl: 'Nederlands',
  de: 'Deutsch',
  es: 'Espanol',
};

export const localeFlags: Record<Locale, string> = {
  en: 'GB',
  fi: 'FI',
  sv: 'SE',
  no: 'NO',
  da: 'DK',
  nl: 'NL',
  de: 'DE',
  es: 'ES',
};
