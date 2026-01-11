# Story 5.5: Implement Language Switcher Functionality

Status: ready-for-dev

## Story

As a **visitor**,
I want **to easily switch the website language**,
So that **I can view content in my preferred language** (FR33, FR35).

## Acceptance Criteria

1. **Given** the website is displayed in any language, **When** a visitor clicks the language switcher, **Then** a dropdown shows all 8 available languages with native names (FR35)

2. **Given** language selection, **Then** selecting a language redirects to the same page in the new locale

3. **Given** language selection, **Then** the language preference is stored (cookie or localStorage)

4. **Given** language switching, **Then** language switch completes within 2 seconds (NFR8)

5. **Given** a missing translation, **Then** English content displays as fallback (NFR42)

6. **Given** the language switcher, **Then** the current language is visually indicated in the switcher

7. **Given** SEO requirements, **Then** hreflang meta tags are updated for SEO

## Tasks / Subtasks

- [ ] Task 1: Create LanguageSwitcher Component (AC: #1, #6)
  - [ ] Create `src/components/layout/LanguageSwitcher.tsx`
  - [ ] Display current language with flag/code
  - [ ] Create dropdown with all 8 languages
  - [ ] Show native language names
  - [ ] Highlight current language

- [ ] Task 2: Implement Language Switching Logic (AC: #2, #4)
  - [ ] Use next-intl navigation helpers
  - [ ] Preserve current path on switch
  - [ ] Handle dynamic route parameters
  - [ ] Ensure fast client-side navigation

- [ ] Task 3: Store Language Preference (AC: #3)
  - [ ] Set NEXT_LOCALE cookie on switch
  - [ ] Configure middleware to read preference
  - [ ] Persist preference across sessions

- [ ] Task 4: Configure Fallback Behavior (AC: #5)
  - [ ] Configure next-intl for fallback to English
  - [ ] Test missing key handling
  - [ ] Add console warning for missing keys in dev

- [ ] Task 5: Add hreflang Tags (AC: #7)
  - [ ] Configure in layout or page metadata
  - [ ] Generate for all supported locales
  - [ ] Include canonical URL

- [ ] Task 6: Integrate with Header (AC: #1, #6)
  - [ ] Add LanguageSwitcher to Header component
  - [ ] Position in navigation
  - [ ] Style for both transparent and solid header states

- [ ] Task 7: Add Mobile Support
  - [ ] Language switcher in mobile menu
  - [ ] Full-width selection on mobile
  - [ ] Touch-friendly targets

## Dev Notes

### LanguageSwitcher Component

```tsx
// src/components/layout/LanguageSwitcher.tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Language {
  code: string
  name: string
  nativeName: string
  flag?: string
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
]

interface LanguageSwitcherProps {
  variant?: 'default' | 'light'
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0]

  const switchLanguage = (newLocale: string) => {
    // Replace current locale in path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)

    // Store preference in cookie
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`

    startTransition(() => {
      router.push(newPath)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2',
            variant === 'light' && 'text-white hover:bg-white/10'
          )}
          aria-label="Select language"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
          <span className="sm:hidden">{currentLanguage.code.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              locale === language.code && 'bg-forest-50'
            )}
          >
            <div className="flex items-center gap-2">
              <span>{language.flag}</span>
              <span>{language.nativeName}</span>
            </div>
            {locale === language.code && (
              <Check className="h-4 w-4 text-forest-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### next-intl Configuration

```typescript
// src/i18n/config.ts
export const locales = ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

// Labels for each locale
export const localeLabels: Record<Locale, string> = {
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

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale } from './config'

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  const safeLocale = locales.includes(locale as any) ? locale : defaultLocale

  // Load messages with fallback
  let messages
  try {
    messages = (await import(`../messages/${safeLocale}.json`)).default
  } catch {
    // Fallback to English
    messages = (await import(`../messages/en.json`)).default
    console.warn(`Missing translation file for ${locale}, using English fallback`)
  }

  return {
    locale: safeLocale,
    messages,
    timeZone: 'Europe/Helsinki',
    onError: (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[i18n]', error.message)
      }
    },
    getMessageFallback: ({ namespace, key }) => {
      // Return key as fallback in development for debugging
      return process.env.NODE_ENV === 'development'
        ? `[${namespace}.${key}]`
        : key
    },
  }
})
```

### Middleware Configuration

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n/config'

export default createMiddleware({
  // List of all supported locales
  locales,

  // Default locale when no locale matches
  defaultLocale,

  // Use cookie to remember preference
  localePrefix: 'always',

  // Detect locale from cookie first, then Accept-Language header
  localeDetection: true,
})

export const config = {
  // Match all paths except static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

### hreflang Configuration

```tsx
// src/app/[locale]/layout.tsx
import { locales, defaultLocale } from '@/i18n/config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  // Generate hreflang alternates
  const alternates: Record<string, string> = {}
  locales.forEach((l) => {
    alternates[l] = `/${l}`
  })

  return {
    alternates: {
      canonical: `/${locale}`,
      languages: alternates,
    },
  }
}
```

### Header Integration

```tsx
// Update src/components/layout/Header.tsx
import { LanguageSwitcher } from './LanguageSwitcher'

export function Header({ transparent = false }: { transparent?: boolean }) {
  return (
    <header className={cn(
      'sticky top-0 z-50 transition-colors',
      transparent ? 'bg-transparent' : 'bg-cream-50 border-b'
    )}>
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Logo />

          {/* Navigation Links */}
          <NavigationLinks />

          {/* Right side: Language + Quote CTA */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher variant={transparent ? 'light' : 'default'} />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/quote">Request Quote</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
```

### Mobile Language Switcher

```tsx
// For mobile menu, create expanded version
export function MobileLanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchLanguage = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
    router.push(newPath)
  }

  return (
    <div className="py-4 border-t">
      <p className="text-sm text-stone-500 mb-3">Language</p>
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((language) => (
          <button
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg text-left transition-colors',
              locale === language.code
                ? 'bg-forest-500 text-white'
                : 'bg-stone-100 hover:bg-stone-200'
            )}
          >
            <span>{language.flag}</span>
            <span className="text-sm">{language.nativeName}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Performance Notes

- Language switch uses `startTransition` for smooth UX
- Client-side navigation avoids full page reload
- Cookie storage persists preference without additional requests
- NFR8: Switch completes within 2 seconds via client navigation

### Testing Considerations

- Test all 8 languages switch correctly
- Test preference persistence across sessions
- Test fallback to English for missing translations
- Test hreflang tags in page source
- Test mobile language switcher
- Verify NFR8 performance target

### Project Structure Notes

Files to create/update:
- `src/components/layout/LanguageSwitcher.tsx`
- `src/i18n/config.ts`
- `src/i18n/request.ts`
- `src/middleware.ts` (update)
- `src/components/layout/Header.tsx` (update)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR33-FR35]
- [Source: _bmad-output/planning-artifacts/architecture.md#i18n]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR8-NFR42]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
