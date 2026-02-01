# Story 2.4: Populate 8 Production Journey Stages

Status: done

## Story

As a **visitor**,
I want **to experience each stage of the production journey with unique visuals and messaging**,
So that **I understand how Timber International controls quality from forest to delivery**.

## Acceptance Criteria

1. **Given** the JourneyStage component exists, **When** the homepage renders, **Then** 8 stages are displayed in order:
   - Stage 1: **Forest** - Sustainability, stewardship message
   - Stage 2: **Sawmill** - Skilled craftsmanship message
   - Stage 3: **Kilns** - Patience, mastery, slow drying message
   - Stage 4: **Elements/Panels** - Human touch, manual selection message
   - Stage 5: **CNC** - Craft meets technology message
   - Stage 6: **Finishing** - Sustainable finishes message
   - Stage 7: **Quality Control** - Accountability, zero compromise message
   - Stage 8: **Delivery** - Trust, reliability message

2. **Given** the stages are displayed, **Then** each stage has production photos showing actual Timber International facilities

3. **Given** the stages are displayed, **Then** each stage has headline and subtext content

4. **Given** i18n is configured, **Then** translation keys exist in all 8 locale message files

5. **Given** all stages are rendered, **Then** the journey feels cohesive with consistent pacing between stages

## Tasks / Subtasks

- [x] Task 1: Add Production Photos for All 8 Stages (AC: #2)
  - [x] 1.1 Create/verify `public/images/journey/` directory exists
  - [x] 1.2 Add forest.jpg - Oak forest scene (company photo)
  - [x] 1.3 Add sawmill.jpg - Logs arriving at sawmill (company photo)
  - [x] 1.4 Add kilns.jpg - Drying kilns with stacked lumber (company photo)
  - [x] 1.5 Add elements.jpg - Worker with wood elements (company photo)
  - [x] 1.6 Add cnc.jpg - CNC machine with operator (company photo)
  - [x] 1.7 Add finishing.jpg - Finishing room with work tables (company photo)
  - [x] 1.8 Add qualityControl.jpg - Forklift in warehouse (company photo)
  - [x] 1.9 Add delivery.jpg - Packaged panels in truck (company photo)

- [x] Task 2: Define/Verify English Content for All 8 Stages (AC: #1, #3, #4)
  - [x] 2.1 Create/verify journey section in `src/messages/en.json`
  - [x] 2.2 Add headline and description for Forest stage (sustainability focus)
  - [x] 2.3 Add headline and description for Sawmill stage (craftsmanship focus)
  - [x] 2.4 Add headline and description for Kilns stage (patience/mastery focus)
  - [x] 2.5 Add headline and description for Elements stage (human touch focus)
  - [x] 2.6 Add headline and description for CNC stage (technology meets craft)
  - [x] 2.7 Add headline and description for Finishing stage (sustainable finishes)
  - [x] 2.8 Add headline and description for Quality Control stage (zero compromise)
  - [x] 2.9 Add headline and description for Delivery stage (trust/reliability)

- [x] Task 3: Add Translations for All 7 Additional Locales (AC: #4)
  - [x] 3.1 Translate journey content to Finnish (fi.json)
  - [x] 3.2 Translate journey content to Swedish (sv.json)
  - [x] 3.3 Translate journey content to Norwegian (no.json)
  - [x] 3.4 Translate journey content to Danish (da.json)
  - [x] 3.5 Translate journey content to Dutch (nl.json)
  - [x] 3.6 Translate journey content to German (de.json)
  - [x] 3.7 Translate journey content to Spanish (es.json)

- [x] Task 4: Verify ProductionJourney Component Integration (AC: #1, #5)
  - [x] 4.1 Verify STAGE_KEYS array in ProductionJourney.tsx matches all 8 stages
  - [x] 4.2 Verify image paths match SVG filenames exactly
  - [x] 4.3 Verify translations are fetched correctly via useTranslations('home')
  - [x] 4.4 Verify i18n config (`src/config/i18n.ts`) includes all 8 locales

- [x] Task 5: Visual and Functional Testing (AC: #5)
  - [x] 5.1 Test scroll through all 8 stages renders smoothly
  - [x] 5.2 Test each stage headline and subtext displays correctly
  - [x] 5.3 Verify consistent gradient overlay treatment across stages
  - [x] 5.4 Test at least 2 non-English locales render correctly

- [x] Task 6: Build Validation
  - [x] 6.1 Run `npm run build` - must pass with no errors
  - [x] 6.2 Run `npm run lint` - must pass with no warnings
  - [x] 6.3 Verify no missing translation warnings in console

## Dev Notes

### UX Content Framework (from UX Design Specification)

The 8-stage production journey is the emotional core of the website. Each stage combines powerful imagery with short, impactful text conveying both emotional values and expertise:

| Stage | Key | Emotional Core | Expertise Message |
|-------|-----|----------------|-------------------|
| 1 | forest | Sustainability, stewardship, generational thinking | We plant, nurture, ensure forest continuity |
| 2 | sawmill | Skilled craftsmanship, purposeful work | Experienced hands, precision, respect for material |
| 3 | kilns | Patience, mastery, perfection through time | Slow drying, best programs, uniform colors, no internal stress |
| 4 | elements | Human touch, attention to detail | Manual selection, visual color sorting, defect removal |
| 5 | cnc | Craft meets technology | Human values + latest machinery, precision to spec |
| 6 | finishing | Care for health & planet | Sustainable ecological finishes, no harmful adhesives |
| 7 | qualityControl | Accountability, zero compromise | Each product inspected before packing |
| 8 | delivery | Trust, reliability | Client receives exactly what ordered |

**Copywriting Guidelines:**
- Headlines: 1-3 words, emotional, somewhat poetic
- Subtexts: 1-2 sentences max, expertise message
- Tone: Professional warmth, not corporate coldness

### Stage Configuration (existing in ProductionJourney.tsx)

```typescript
const STAGE_KEYS = [
  "forest",
  "sawmill",
  "kilns",
  "elements",
  "cnc",
  "finishing",
  "qualityControl",
  "delivery",
] as const;
```

### Translation Keys Structure

All locale files should have this structure in `src/messages/{locale}.json`:

```json
{
  "home": {
    "journey": {
      "progressNavigation": "Journey progress",
      "stageOf": "Stage {current} of {total}",
      "goToStage": "Go to stage {number}",
      "forest": "Sustainable Forests",
      "forestDescription": "Responsibly sourced from certified European oak forests, ensuring generations of growth.",
      "sawmill": "Skilled Craftsmanship",
      "sawmillDescription": "Traditional milling techniques meet modern precision in experienced hands.",
      "kilns": "Patient Mastery",
      "kilnsDescription": "Slow-dried to perfection, achieving uniform color and zero internal stress.",
      "elements": "Elements & Panels",
      "elementsDescription": "Hand-selected pieces, visually sorted for color harmony and quality.",
      "cnc": "CNC Precision",
      "cncDescription": "Where traditional craft values meet cutting-edge machinery.",
      "finishing": "Sustainable Finishing",
      "finishingDescription": "Ecological finishes applied with care for health and planet.",
      "qualityControl": "Quality Control",
      "qualityControlDescription": "Every piece inspected - zero compromise before packing.",
      "delivery": "Reliable Delivery",
      "deliveryDescription": "Exactly what you ordered, when you need it, worldwide.",
      "stageAlt": "Production stage {number}: {name}"
    }
  }
}
```

### Placeholder SVG Structure

All SVGs should follow this consistent format (1920x1080 viewBox):

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="{stageKey}Grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:{topColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{bottomColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#{stageKey}Grad)"/>
  <text x="50%" y="50%" fill="white" fill-opacity="0.1" font-size="120" font-family="serif" text-anchor="middle" dominant-baseline="middle">{StageName}</text>
</svg>
```

**Note:** These are temporary placeholders. Real photos/videos will replace them in a future story.

### Locales Supported (order matches src/config/i18n.ts)

| Locale | Language | File |
|--------|----------|------|
| en | English (default) | src/messages/en.json |
| fi | Finnish | src/messages/fi.json |
| sv | Swedish | src/messages/sv.json |
| no | Norwegian | src/messages/no.json |
| da | Danish | src/messages/da.json |
| nl | Dutch | src/messages/nl.json |
| de | German | src/messages/de.json |
| es | Spanish | src/messages/es.json |

### Project Context Rules (CRITICAL)

From `project-context.md` - must follow these:

- **TypeScript:** Strict mode ON, no `any` types
- **All user-facing strings:** Must use `useTranslations()`
- **No hardcoded text:** Even "Loading..." must be translated
- **Use `next/image`:** For all images (already done in JourneyStage)
- **Error boundary:** Already wrapped in ProductionJourneyWithErrorBoundary

### Previous Story Learnings (Story 2-3)

**What worked:**
- IntersectionObserver with null check on `entries[0]`
- useReducedMotion hook for accessibility
- SVG placeholders work well with next/image
- i18n keys nested under `home.journey.*`
- "Reveal once" animation pattern - content stays visible after first reveal

**Patterns established:**
- Client components marked with `'use client'`
- Barrel exports from feature folders
- Stage data attributes: `data-stage={number}` and `id={stage-${number}}`
- Translation pattern: `t('journey.${stageKey}')` for headline, `t('journey.${stageKey}Description')` for subtext

**Files created in Story 2-3:**
- `src/components/features/home/JourneyStage.tsx` - Stage component (COMPLETE)
- `src/components/features/home/ProductionJourneyWithErrorBoundary.tsx` - Error boundary wrapper (COMPLETE)
- `src/components/ui/ErrorBoundary.tsx` - Generic error boundary (COMPLETE)
- `public/images/journey/*.svg` - Placeholder images (8 files, VERIFIED)

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Production-Journey-Framework]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual-Design-Foundation]
- [Source: _bmad-output/planning-artifacts/marketing-website/epics.md#Story-2.4]
- [Source: _bmad-output/implementation-artifacts/2-3-implement-journeystage-component.md]
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules]

## File List

**Journey images (8 files - Timber International company photos):**
- `public/images/journey/forest.jpg` - Oak forest scene
- `public/images/journey/sawmill.jpg` - Logs arriving at sawmill
- `public/images/journey/kilns.jpg` - Drying kilns with stacked lumber
- `public/images/journey/elements.jpg` - Worker with wood elements
- `public/images/journey/cnc.jpg` - CNC machine with operator
- `public/images/journey/finishing.jpg` - Finishing room with work tables
- `public/images/journey/qualityControl.jpg` - Forklift in warehouse
- `public/images/journey/delivery.jpg` - Packaged panels in truck

**Locale files (8 files - VERIFIED with journey translations):**
- `src/messages/en.json` - English (default)
- `src/messages/fi.json` - Finnish
- `src/messages/sv.json` - Swedish
- `src/messages/no.json` - Norwegian
- `src/messages/da.json` - Danish
- `src/messages/nl.json` - Dutch
- `src/messages/de.json` - German
- `src/messages/es.json` - Spanish

**Component files (MODIFIED):**
- `src/components/features/home/ProductionJourney.tsx` - Updated imageFallback to use .jpg, added conditional progress indicator
- `src/components/features/home/HeroSection.tsx` - Updated video paths from /videos to /hero
- `src/hooks/useJourneyProgress.ts` - Fixed progress indicator to reset when scrolling back to hero
- `src/config/i18n.ts` - All 8 locales configured (no changes)

**Hero assets reorganized:**
- `public/hero/forest.webm` - Hero video (moved from /videos)
- `public/hero/forest.mp4` - Hero video fallback (moved from /videos)

**Deleted files:**
- `public/images/hero/forest.webp` - Removed (using journey forest.jpg as poster)
- `public/images/journey/*.svg` - Removed 8 SVG placeholders (replaced with JPGs)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- All 8 locale files verified with complete journey translation keys
- ProductionJourney.tsx STAGE_KEYS array matches 8 stages (forest, sawmill, kilns, elements, cnc, finishing, qualityControl, delivery)
- Translations fetched via `useTranslations("home")` with `t('journey.${stageKey}')` pattern
- i18n config (`src/config/i18n.ts`) includes all 8 locales: en, fi, sv, no, da, nl, de, es
- Build passes successfully with no errors
- Lint passes on source code (excluded framework files)
- No missing translation warnings
- Cleaned up stale `.next 2` build directory
- **UPGRADED:** Replaced SVG gradient placeholders with real Timber International company photos
- Added 8 production photos for each journey stage
- Updated ProductionJourney.tsx to reference .jpg instead of .svg files
- Removed old SVG placeholder files
- Reorganized hero assets: moved videos from /videos to /hero folder
- Fixed progress indicator visibility (hidden on hero, shows on journey stages)

### Senior Developer Review (AI)

**Reviewed by:** Claude Opus 4.5 (Code Review Agent)
**Date:** 2026-01-16
**Outcome:** APPROVED

**Issues Found and Fixed:**
1. **[MEDIUM]** Updated File List to reflect actual company photos instead of Unsplash
2. **[MEDIUM]** Documented related changes (HeroSection.tsx, useJourneyProgress.ts)
3. **[LOW]** Updated AC #2 wording from "placeholder" to "production photos"

**Validation:**
- ✅ All 5 Acceptance Criteria implemented and verified
- ✅ All 6 Tasks verified complete
- ✅ Build passes
- ✅ Lint passes (project code)
- ✅ File List matches actual changes

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-11 | Story created fresh from epics with comprehensive dev notes | Claude |
| 2026-01-11 | All tasks verified complete, status changed to review | Claude |
| 2026-01-11 | Upgraded placeholder SVGs to real Unsplash photos (8 JPG files) | Claude |
| 2026-01-16 | Replaced Unsplash photos with actual Timber International company photos | Nils |
| 2026-01-16 | Code review completed, documentation updated, status changed to done | Claude |
