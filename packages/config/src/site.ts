export const siteConfig = {
  name: 'Timber International',
  description:
    'Premium oak panels and wood products - From forest to finished product',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://timber-international.com',
  defaultLocale: 'en',
  locales: ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es'],
  navigation: [
    { name: 'Products', href: '/products', key: 'products' },
    { name: 'Resources', href: '/resources', key: 'resources' },
    { name: 'Contact', href: '/contact', key: 'contact' },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
