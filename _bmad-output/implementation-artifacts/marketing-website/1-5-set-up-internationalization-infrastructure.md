# Story 1.5: Set Up Internationalization Infrastructure

Status: done

## Story

As a **developer**,
I want **i18n infrastructure configured with next-intl**,
So that **the website can support 8 languages with proper routing and SEO**.

## Acceptance Criteria

1. **Given** the Next.js project with layout components, **When** next-intl is configured, **Then** the [locale] dynamic route segment is implemented

2. **Given** next-intl is configured, **Then** middleware detects browser language and redirects appropriately

3. **Given** next-intl is configured, **Then** English (en) translation file is created with initial keys for navigation, common UI, and meta tags

4. **Given** next-intl is configured, **Then** Placeholder files are created for fi, sv, no, da, nl, de, es locales

5. **Given** next-intl is configured, **Then** LanguageSwitcher component displays current language and dropdown to switch

6. **Given** a page with translations, **Then** hreflang meta tags are generated for all supported locales

7. **Given** a URL structure, **Then** URL structure follows /[locale]/page pattern (e.g., /en/products, /de/products)

8. **Given** the default locale, **Then** Default locale (en) works without locale prefix (optional: /products redirects to /en/products)

## Tasks / Subtasks

- [x] Task 1: Install and Configure next-intl (AC: #1)
  - [x] Run `npm install next-intl`
  - [x] Create `src/i18n/request.ts` configuration file
  - [x] Create `src/config/i18n.ts` with locale definitions
  - [x] Update `next.config.ts` with next-intl plugin

- [x] Task 2: Create Locale Route Structure (AC: #1, #7)
  - [x] Create `src/app/[locale]/layout.tsx`
  - [x] Create `src/app/[locale]/page.tsx`
  - [x] Move existing pages under [locale] directory
  - [x] Set up locale parameter handling

- [x] Task 3: Configure Middleware (AC: #2, #8)
  - [x] Update `src/middleware.ts` for i18n routing
  - [x] Implement browser language detection
  - [x] Configure locale redirection
  - [x] Handle default locale routing

- [x] Task 4: Create English Translation File (AC: #3)
  - [x] Create `src/messages/en.json`
  - [x] Add navigation keys (Products, Resources, Contact)
  - [x] Add common UI keys (loading, error, success)
  - [x] Add meta tag keys (title, description)
  - [x] Add homepage keys (hero, journey stages)

- [x] Task 5: Create Placeholder Translation Files (AC: #4)
  - [x] Create `src/messages/fi.json` (Finnish)
  - [x] Create `src/messages/sv.json` (Swedish)
  - [x] Create `src/messages/no.json` (Norwegian)
  - [x] Create `src/messages/da.json` (Danish)
  - [x] Create `src/messages/nl.json` (Dutch)
  - [x] Create `src/messages/de.json` (German)
  - [x] Create `src/messages/es.json` (Spanish)
  - [x] Translated content for all locales

- [x] Task 6: Implement LanguageSwitcher Component (AC: #5)
  - [x] Update existing `src/components/layout/LanguageSwitcher.tsx` (placeholder from Story 1-4)
  - [x] Display current language with flag/code
  - [x] Create dropdown with all 8 languages
  - [x] Show native language names
  - [x] Navigate to same page in new locale
  - [x] Store preference in cookie
  - [x] Remove disabled state from placeholder

- [x] Task 7: Generate hreflang Meta Tags (AC: #6)
  - [x] Create utility function for hreflang generation
  - [x] Add hreflang tags to page metadata
  - [x] Include x-default for English
  - [x] Verify correct URL structure

## Dev Notes

### Supported Locales

| Code | Language | Native Name |
|------|----------|-------------|
| en | English | English |
| fi | Finnish | Suomi |
| sv | Swedish | Svenska |
| no | Norwegian | Norsk |
| da | Danish | Dansk |
| nl | Dutch | Nederlands |
| de | German | Deutsch |
| es | Spanish | Español |

### i18n Configuration

```typescript
// src/config/i18n.ts
export const locales = ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fi: 'Suomi',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  nl: 'Nederlands',
  de: 'Deutsch',
  es: 'Español',
}
```

### next-intl Setup

```typescript
// src/i18n.ts
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}))
```

### Translation File Structure

```json
// src/messages/en.json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Success"
  },
  "nav": {
    "products": "Products",
    "resources": "Resources",
    "contact": "Contact",
    "requestQuote": "Request Quote"
  },
  "meta": {
    "title": "Timber International",
    "description": "Premium oak panels and wood products"
  },
  "home": {
    "heroSlogan": "From Forest to Finished Product",
    "journey": {
      "forest": "Sustainable Forests",
      "sawmill": "Skilled Craftsmanship",
      "kilns": "Patient Mastery"
    }
  }
}
```

### Middleware Configuration

```typescript
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from '@/config/i18n'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed' // Hide prefix for default locale
})

export const config = {
  matcher: ['/', '/(de|en|fi|sv|no|da|nl|es)/:path*']
}
```

### hreflang Implementation

```typescript
// In page metadata
export async function generateMetadata({ params: { locale } }) {
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en': '/en',
        'fi': '/fi',
        'sv': '/sv',
        // ... other locales
        'x-default': '/en',
      },
    },
  }
}
```

### NFR Requirements

- NFR8: Language switch < 2 seconds
- NFR42: If translation service unavailable, English content displays

### Prerequisites from Story 1-4

- **LanguageSwitcher placeholder** exists at `src/components/layout/LanguageSwitcher.tsx` - currently disabled, displays "EN"
- **Hardcoded strings** in layout components need to be converted to use `useTranslations()`:
  - `Header.tsx` - "Timber International", "Request Quote"
  - `Footer.tsx` - Company description, section headings, copyright text
  - `MobileMenu.tsx` - "Timber International", "Language", "Request Quote"
  - `SkipLink.tsx` - "Skip to main content"

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Translation]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#FR32-FR35]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Multi-Language]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 8 locales configured and statically generated
- Translation files include full translations (not just placeholders)
- LanguageSwitcher stores preference in NEXT_LOCALE cookie
- All layout components converted to use useTranslations()
- Locale-aware Link and usePathname used throughout
- hreflang metadata generated via Next.js metadata API

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-10 | Initial implementation of i18n infrastructure | Claude |
| 2026-01-10 | Code review fixes: hardcoded strings, cookie storage, locale-aware links | Claude |
| 2026-01-10 | Epic 1 final review: Fixed React Compiler lint error with cookie utility | Claude |

### File List

**Created:**
- `src/lib/utils/cookies.ts` - Cookie utility functions (setCookie, getCookie)
- `src/config/i18n.ts` - Locale definitions, names, and flags
- `src/i18n/request.ts` - next-intl server configuration
- `src/i18n/routing.ts` - Routing and navigation exports
- `src/i18n/index.ts` - Barrel exports
- `src/app/[locale]/layout.tsx` - Locale-specific layout with metadata
- `src/app/[locale]/page.tsx` - Homepage with translations
- `src/lib/i18n/hreflang.ts` - hreflang utility functions
- `src/messages/en.json` - English translations
- `src/messages/fi.json` - Finnish translations
- `src/messages/sv.json` - Swedish translations
- `src/messages/no.json` - Norwegian translations
- `src/messages/da.json` - Danish translations
- `src/messages/nl.json` - Dutch translations
- `src/messages/de.json` - German translations
- `src/messages/es.json` - Spanish translations

**Modified:**
- `next.config.ts` - Added next-intl plugin
- `package.json` - Added next-intl dependency
- `src/app/layout.tsx` - Simplified to minimal root layout
- `src/app/page.tsx` - Redirect to default locale
- `src/middleware.ts` - Combined i18n and auth middleware
- `src/components/layout/LanguageSwitcher.tsx` - Full dropdown with cookie storage
- `src/components/layout/Header.tsx` - Using useTranslations and locale-aware Link
- `src/components/layout/Footer.tsx` - Using useTranslations and locale-aware Link
- `src/components/layout/Navigation.tsx` - Using useTranslations and locale-aware routing
- `src/components/layout/MobileMenu.tsx` - Using useTranslations and locale-aware Link
- `src/components/layout/SkipLink.tsx` - Using useTranslations
- `src/config/site.ts` - Added translation keys to navigation config
