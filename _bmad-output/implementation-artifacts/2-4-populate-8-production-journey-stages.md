# Story 2.4: Populate 8 Production Journey Stages

Status: ready-for-dev

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

2. **Given** the stages are displayed, **Then** each stage has placeholder images/videos (to be replaced with real content)

3. **Given** the stages are displayed, **Then** each stage has headline and subtext content (English, translatable)

4. **Given** i18n is configured, **Then** translation keys are added to the i18n messages files

5. **Given** all stages are rendered, **Then** the journey feels cohesive with consistent pacing between stages

## Tasks / Subtasks

- [ ] Task 1: Create Journey Stage Data Configuration
  - [ ] Create `src/config/journey-stages.ts`
  - [ ] Define all 8 stages with properties
  - [ ] Include image paths, video paths (optional), headline keys, subtext keys

- [ ] Task 2: Add Placeholder Images (AC: #2)
  - [ ] Create `/public/images/journey/` directory
  - [ ] Add placeholder images for each stage
  - [ ] Use WebP format
  - [ ] Optimize to < 500KB each

- [ ] Task 3: Add Translation Keys (AC: #3, #4)
  - [ ] Add `journey` section to `src/messages/en.json`
  - [ ] Add headline for each stage
  - [ ] Add subtext for each stage
  - [ ] Copy to other locale files as placeholders

- [ ] Task 4: Implement Homepage Journey Section (AC: #1, #5)
  - [ ] Update `src/app/[locale]/page.tsx`
  - [ ] Import JourneyStage and ProductionJourney components
  - [ ] Map through stage configuration
  - [ ] Render all 8 stages with correct props

- [ ] Task 5: Add Stage-Specific Content
  - [ ] Stage 1 (Forest): Sustainability messaging
  - [ ] Stage 2 (Sawmill): Craftsmanship messaging
  - [ ] Stage 3 (Kilns): Patience/mastery messaging
  - [ ] Stage 4 (Elements): Human touch messaging
  - [ ] Stage 5 (CNC): Technology messaging
  - [ ] Stage 6 (Finishing): Sustainability messaging
  - [ ] Stage 7 (QC): Accountability messaging
  - [ ] Stage 8 (Delivery): Trust/reliability messaging

- [ ] Task 6: Test Journey Flow
  - [ ] Verify smooth scrolling between stages
  - [ ] Check progress indicator updates
  - [ ] Test on mobile devices
  - [ ] Verify reduced-motion behavior

## Dev Notes

### Stage Configuration

```typescript
// src/config/journey-stages.ts
export const journeyStages = [
  {
    id: 'forest',
    stageNumber: 1,
    imageFallback: '/images/journey/forest.webp',
    videoSrc: '/videos/journey/forest.webm',
    headlineKey: 'journey.forest.headline',
    subtextKey: 'journey.forest.subtext',
    imageAlt: 'Sustainable forest with tall oak trees',
  },
  {
    id: 'sawmill',
    stageNumber: 2,
    imageFallback: '/images/journey/sawmill.webp',
    headlineKey: 'journey.sawmill.headline',
    subtextKey: 'journey.sawmill.subtext',
    imageAlt: 'Sawmill processing oak logs',
  },
  {
    id: 'kilns',
    stageNumber: 3,
    imageFallback: '/images/journey/kilns.webp',
    headlineKey: 'journey.kilns.headline',
    subtextKey: 'journey.kilns.subtext',
    imageAlt: 'Wood drying kilns',
  },
  {
    id: 'panels',
    stageNumber: 4,
    imageFallback: '/images/journey/panels.webp',
    headlineKey: 'journey.panels.headline',
    subtextKey: 'journey.panels.subtext',
    imageAlt: 'Craftsman inspecting oak panels',
  },
  {
    id: 'cnc',
    stageNumber: 5,
    imageFallback: '/images/journey/cnc.webp',
    headlineKey: 'journey.cnc.headline',
    subtextKey: 'journey.cnc.subtext',
    imageAlt: 'CNC machine precision cutting',
  },
  {
    id: 'finishing',
    stageNumber: 6,
    imageFallback: '/images/journey/finishing.webp',
    headlineKey: 'journey.finishing.headline',
    subtextKey: 'journey.finishing.subtext',
    imageAlt: 'Applying sustainable wood finish',
  },
  {
    id: 'quality',
    stageNumber: 7,
    imageFallback: '/images/journey/quality.webp',
    headlineKey: 'journey.quality.headline',
    subtextKey: 'journey.quality.subtext',
    imageAlt: 'Quality inspector checking panels',
  },
  {
    id: 'delivery',
    stageNumber: 8,
    imageFallback: '/images/journey/delivery.webp',
    headlineKey: 'journey.delivery.headline',
    subtextKey: 'journey.delivery.subtext',
    imageAlt: 'Loaded truck ready for delivery',
  },
] as const
```

### Translation Content

```json
// src/messages/en.json
{
  "journey": {
    "forest": {
      "headline": "Sustainable Stewardship",
      "subtext": "Our journey begins in responsibly managed forests, where we select oak trees that meet our exacting standards for quality and sustainability."
    },
    "sawmill": {
      "headline": "Skilled Craftsmanship",
      "subtext": "Expert sawyers transform raw logs into precise cuts, maximizing yield while maintaining the natural beauty of each piece."
    },
    "kilns": {
      "headline": "Patient Mastery",
      "subtext": "Time is our ally. Slow kiln drying over weeks ensures stable moisture content and prevents warping for decades to come."
    },
    "panels": {
      "headline": "The Human Touch",
      "subtext": "Every panel is hand-selected and assembled by craftspeople who understand that quality cannot be rushed."
    },
    "cnc": {
      "headline": "Craft Meets Technology",
      "subtext": "Precision CNC machines execute your exact specifications while preserving the warmth of natural wood."
    },
    "finishing": {
      "headline": "Sustainable Beauty",
      "subtext": "Our eco-friendly finishes enhance natural grain while protecting your investment for generations."
    },
    "quality": {
      "headline": "Zero Compromise",
      "subtext": "Every product passes through rigorous inspection. Our reputation depends on what leaves our facility."
    },
    "delivery": {
      "headline": "Trust Delivered",
      "subtext": "From our facility to your site, we ensure your materials arrive in perfect condition, on time, every time."
    }
  }
}
```

### Homepage Implementation

```tsx
// src/app/[locale]/page.tsx
import { useTranslations } from 'next-intl'
import { HeroSection } from '@/components/features/home/HeroSection'
import { ProductionJourney } from '@/components/features/home/ProductionJourney'
import { JourneyStage } from '@/components/features/home/JourneyStage'
import { journeyStages } from '@/config/journey-stages'

export default function HomePage() {
  const t = useTranslations()

  return (
    <>
      <HeroSection />
      <ProductionJourney>
        {journeyStages.map((stage) => (
          <JourneyStage
            key={stage.id}
            stageNumber={stage.stageNumber}
            videoSrc={stage.videoSrc}
            imageFallback={stage.imageFallback}
            imageAlt={stage.imageAlt}
            headline={t(stage.headlineKey)}
            subtext={t(stage.subtextKey)}
          />
        ))}
      </ProductionJourney>
    </>
  )
}
```

### Image Placeholders

Use high-quality stock photos as placeholders:
- Royalty-free forest/lumber images
- Optimize all to WebP format
- Target 1920x1080 resolution
- Compress to < 500KB each

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Production-Journey-Stages]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3]
- [Source: _bmad-output/planning-artifacts/product-brief.md#Production-Orchestrator]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
