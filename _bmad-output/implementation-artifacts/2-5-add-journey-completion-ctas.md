# Story 2.5: Add Journey Completion CTAs

Status: ready-for-dev

## Story

As a **visitor**,
I want **clear calls-to-action at the end of the production journey**,
So that **I can take the next step toward working with Timber International**.

## Acceptance Criteria

1. **Given** the visitor has scrolled through all 8 journey stages, **When** they reach the end of the journey, **Then** a CTA section displays with two prominent buttons: "View Products" and "Request Quote"

2. **Given** the CTA buttons are displayed, **Then** buttons use the primary (Forest Green) and secondary button styles

3. **Given** the "View Products" button, **When** clicked, **Then** it links to /[locale]/products

4. **Given** the "Request Quote" button, **When** clicked, **Then** it links to /[locale]/quote

5. **Given** the CTA section is displayed, **Then** the section maintains the visual aesthetic (background image/color, proper spacing)

6. **Given** the CTA section is displayed, **Then** a subtle animation draws attention to the CTAs

7. **Given** keyboard users, **Then** buttons are keyboard accessible and have visible focus states

## Tasks / Subtasks

- [ ] Task 1: Create JourneyCTA Component (AC: #1, #5)
  - [ ] Create `src/components/features/home/JourneyCTA.tsx`
  - [ ] Set up full-screen section (100vh) as final journey stage
  - [ ] Add background image or solid color treatment
  - [ ] Center content vertically and horizontally

- [ ] Task 2: Add CTA Buttons (AC: #1, #2)
  - [ ] Add "View Products" button (primary style - Forest Green)
  - [ ] Add "Request Quote" button (secondary style - outlined)
  - [ ] Use shadcn/ui Button component with variants
  - [ ] Style buttons for prominence (larger size)

- [ ] Task 3: Configure Button Links (AC: #3, #4)
  - [ ] Import Link from next-intl
  - [ ] Set "View Products" href to `/products`
  - [ ] Set "Request Quote" href to `/quote`
  - [ ] Ensure locale is preserved in routing

- [ ] Task 4: Add Visual Animation (AC: #6)
  - [ ] Create fade-in animation on scroll
  - [ ] Add subtle scale or glow effect
  - [ ] Stagger button animations
  - [ ] Respect prefers-reduced-motion

- [ ] Task 5: Ensure Accessibility (AC: #7)
  - [ ] Add proper focus states
  - [ ] Ensure keyboard navigation works
  - [ ] Add aria-labels if needed
  - [ ] Test with screen reader

- [ ] Task 6: Add Supporting Content
  - [ ] Add headline text above buttons
  - [ ] Add translation keys
  - [ ] Style with appropriate typography

## Dev Notes

### Component Design

```tsx
'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useInView } from '@/hooks/useInView'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

export function JourneyCTA() {
  const t = useTranslations('journey.cta')
  const { ref, inView } = useInView({ threshold: 0.3 })
  const reducedMotion = useReducedMotion()

  return (
    <section
      ref={ref}
      className="relative h-screen w-full snap-start flex items-center justify-center bg-forest-green"
    >
      {/* Background Pattern/Image */}
      <div className="absolute inset-0 bg-[url('/images/journey/cta-bg.webp')] bg-cover bg-center opacity-20" />

      {/* Content */}
      <div
        className={cn(
          'relative z-10 text-center text-white px-8 transition-all duration-700',
          inView && !reducedMotion
            ? 'opacity-100 translate-y-0'
            : reducedMotion
            ? 'opacity-100'
            : 'opacity-0 translate-y-8'
        )}
      >
        <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl mb-4">
          {t('headline')}
        </h2>
        <p className="font-body text-lg md:text-xl text-white/80 mb-12 max-w-xl mx-auto">
          {t('subtext')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className={cn(
              'bg-warm-cream text-forest-green hover:bg-white text-lg px-8 py-6',
              'transition-all duration-500',
              inView && !reducedMotion ? 'delay-200' : ''
            )}
          >
            <Link href="/products">
              {t('viewProducts')}
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className={cn(
              'border-2 border-white text-white hover:bg-white hover:text-forest-green text-lg px-8 py-6',
              'transition-all duration-500',
              inView && !reducedMotion ? 'delay-300' : ''
            )}
          >
            <Link href="/quote">
              {t('requestQuote')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
```

### Translation Keys

```json
// Add to src/messages/en.json
{
  "journey": {
    "cta": {
      "headline": "Ready to Begin?",
      "subtext": "Discover our premium oak panels or request a personalized quote for your project.",
      "viewProducts": "View Products",
      "requestQuote": "Request Quote"
    }
  }
}
```

### Button Styling

Primary button (View Products):
- Background: Warm Cream (#FAF6F1)
- Text: Forest Green (#1B4332)
- Hover: White background
- Large size (lg)

Secondary button (Request Quote):
- Border: White, 2px
- Text: White
- Background: Transparent
- Hover: White bg, Forest Green text
- Large size (lg)

### Animation Sequence

1. Section enters viewport (50% threshold)
2. Headline fades in (0ms delay)
3. Subtext fades in (100ms delay)
4. Primary button fades in (200ms delay)
5. Secondary button fades in (300ms delay)

### Visual Design

- Full-screen section
- Forest Green background with subtle texture/pattern
- White text for contrast
- Generous spacing
- Premium, confident aesthetic

### Accessibility

- Buttons are native elements (inherent accessibility)
- Focus states clearly visible
- Sufficient color contrast
- Keyboard navigation works naturally

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#CTA-Design]
- [Source: _bmad-output/planning-artifacts/prd.md#FR4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Accessibility]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
