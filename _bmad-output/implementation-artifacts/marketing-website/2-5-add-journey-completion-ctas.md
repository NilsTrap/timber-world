# Story 2.5: Add Journey Completion CTAs

Status: done

## Story

As a **visitor**,
I want **clear calls-to-action at the end of the production journey**,
So that **I can take the next step toward working with Timber International**.

## Acceptance Criteria

1. **Given** the visitor has scrolled through all 8 journey stages, **When** they reach the end, **Then** a CTA section displays with two prominent buttons: "View Products" and "Request Quote"

2. **Given** the CTA section is displayed, **Then** buttons use primary (Forest Green #1B4332) and secondary button styles

3. **Given** the CTA buttons exist, **Then** "View Products" links to `/[locale]/products`

4. **Given** the CTA buttons exist, **Then** "Request Quote" links to `/[locale]/quote`

5. **Given** the CTA section is displayed, **Then** it maintains the visual aesthetic (background, proper spacing)

6. **Given** the CTA section is displayed, **Then** a subtle animation draws attention to the CTAs

7. **Given** the CTA buttons exist, **Then** they are keyboard accessible with visible focus states

8. **Given** i18n is configured, **Then** button text is translated in all 8 locale files

## Tasks / Subtasks

- [x] Task 1: Create JourneyCompletionCTA Component (AC: #1, #2, #5)
  - [x] 1.1 Create src/components/features/home/JourneyCompletionCTA.tsx
  - [x] 1.2 Design full-screen section with forest background
  - [x] 1.3 Add gradient overlay for text readability
  - [x] 1.4 Center content container with headline and buttons
  - [x] 1.5 Export from src/components/features/home/index.ts

- [x] Task 2: Implement CTA Buttons (AC: #2, #3, #4, #7)
  - [x] 2.1 Create primary button: "View Products" with Forest Green background
  - [x] 2.2 Create secondary button: "Request Quote" with outline style
  - [x] 2.3 Add proper href links with locale prefix
  - [x] 2.4 Add focus-visible states for keyboard accessibility

- [x] Task 3: Add Scroll-Triggered Animation (AC: #6)
  - [x] 3.1 Use IntersectionObserver for scroll detection
  - [x] 3.2 Implement fade-in and slide-up animation
  - [x] 3.3 Respect useReducedMotion preference

- [x] Task 4: Add i18n Translations (AC: #8)
  - [x] 4.1 Add English translations in en.json
  - [x] 4.2 Add translations for all 7 additional locales

- [x] Task 5: Integrate with ProductionJourney (AC: #1)
  - [x] 5.1 Import JourneyCompletionCTA in ProductionJourney.tsx
  - [x] 5.2 Add as final section after journey stages

- [x] Task 6: Testing and Validation
  - [x] 6.1 Test button navigation
  - [x] 6.2 Test keyboard accessibility
  - [x] 6.3 Run npm run build - must pass
  - [x] 6.4 Run npm run lint - must pass (framework warnings only)

## Dev Notes

### Button Styles (from UX spec)
- Primary: Forest Green bg (#1B4332), white text, 48px height
- Secondary: White bg, Forest Green border/text, 48px height

### i18n Keys
- journey.ctaHeadline
- journey.ctaSubtext
- journey.viewProducts
- journey.requestQuote

## File List

**Created:**
- src/components/features/home/JourneyCompletionCTA.tsx

**Modified:**
- src/components/features/home/ProductionJourney.tsx
- src/components/features/home/index.ts
- src/messages/*.json (all 8 locales)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 | **Date:** 2026-01-16

**Issues Found:** 2 High, 2 Medium, 3 Low

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | Secondary button colors didn't match spec (white/transparent instead of white bg, Forest Green border/text) | Fixed: Updated to `bg-white`, `border-[#1B4332]`, `text-[#1B4332]` |
| HIGH | New component file not staged in git | Fixed: Ran `git add` |
| MEDIUM | Button height used padding instead of fixed 48px | Fixed: Changed `py-4` to `h-12` |
| MEDIUM | Story File List incomplete | Fixed: Added sprint-status.yaml |
| LOW | Hardcoded animation delays | Deferred: Acceptable for MVP |
| LOW | Magic color for overlay | Deferred: Acceptable for MVP |
| LOW | Empty alt on decorative image | Deferred: WCAG compliant as-is |

**Build Status:** ✅ Passed
**Recommendation:** APPROVED - All HIGH and MEDIUM issues resolved

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-01-16 | Story created, status in-progress | Claude |
| 2026-01-16 | Created JourneyCompletionCTA component with full-screen layout, Forest Green buttons, scroll-triggered animation | Claude |
| 2026-01-16 | Added i18n translations to all 8 locales (en, fi, sv, no, da, nl, de, es) | Claude |
| 2026-01-16 | Integrated with ProductionJourney.tsx, build passed, status review | Claude |
| 2026-01-16 | Code review: Fixed secondary button colors, button height, staged file, updated File List. Status done | Claude |
