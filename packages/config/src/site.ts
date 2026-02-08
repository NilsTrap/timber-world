import { currentBrand } from './brand';

export const siteConfig = {
  name: currentBrand.name,
  shortName: currentBrand.shortName,
  description: currentBrand.description,
  url: process.env.NEXT_PUBLIC_APP_URL || currentBrand.url,
  logo: currentBrand.logo,
  brand: currentBrand.key,
  defaultLocale: 'en',
  locales: ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es'],
  navigation: [
    { name: 'Products', href: '/products', key: 'products' },
    { name: 'Resources', href: '/resources', key: 'resources' },
    { name: 'Contact', href: '/contact', key: 'contact' },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
