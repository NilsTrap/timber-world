# Story 2.3: Implement JourneyStage Component

Status: ready-for-dev

## Story

As a **developer**,
I want **a reusable JourneyStage component for each production stage**,
So that **all 8 stages render consistently with the defined visual treatment**.

## Acceptance Criteria

1. **Given** the journey scroll container exists, **When** a JourneyStage component is rendered, **Then** it displays a full-screen background (micro-video or image)

2. **Given** the JourneyStage is rendered, **Then** a gradient overlay (bottom 30-40%) ensures text readability

3. **Given** the JourneyStage is rendered, **Then** the stage headline displays in Playfair Display (large, white/cream)

4. **Given** the JourneyStage is rendered, **Then** the expertise subtext displays in Inter below the headline

5. **Given** scroll-triggered animations are enabled, **Then** content fades in with scroll-triggered animation (unless reduced motion)

6. **Given** images are used, **Then** images use lazy loading and WebP format with fallbacks

7. **Given** accessibility requirements, **Then** alt text is provided for all images

8. **Given** the component interface, **Then** the component accepts props: stageNumber, videoSrc, imageFallback, headline, subtext

## Tasks / Subtasks

- [ ] Task 1: Create JourneyStage Component (AC: #1, #8)
  - [ ] Create `src/components/features/home/JourneyStage.tsx`
  - [ ] Define props interface (stageNumber, videoSrc, imageFallback, headline, subtext)
  - [ ] Set up full-screen section (100vh)
  - [ ] Add scroll-snap-align: start

- [ ] Task 2: Implement Background Media (AC: #1, #6, #7)
  - [ ] Add video element with autoplay, loop, muted
  - [ ] Add next/image for image fallback
  - [ ] Implement lazy loading (loading="lazy")
  - [ ] Use WebP format with fallbacks
  - [ ] Add descriptive alt text
  - [ ] Handle prefers-reduced-motion (show image only)

- [ ] Task 3: Add Gradient Overlay (AC: #2)
  - [ ] Create overlay div with gradient
  - [ ] Gradient from transparent (top) to black/60 (bottom)
  - [ ] Cover bottom 30-40% of viewport
  - [ ] Ensure proper z-indexing

- [ ] Task 4: Style Headline and Subtext (AC: #3, #4)
  - [ ] Add headline element with Playfair Display
  - [ ] Style large, white/cream color
  - [ ] Add subtext element with Inter font
  - [ ] Position in bottom third of viewport
  - [ ] Add proper text shadows for readability

- [ ] Task 5: Implement Scroll Animations (AC: #5)
  - [ ] Create fade-in animation on scroll
  - [ ] Use Intersection Observer for trigger
  - [ ] Add stagger for headline vs subtext
  - [ ] Disable animations for reduced-motion
  - [ ] Use CSS transforms for performance

- [ ] Task 6: Add TypeScript Types
  - [ ] Define JourneyStageProps interface
  - [ ] Export types for use in parent component
  - [ ] Add JSDoc comments

## Dev Notes

### Component Interface

```typescript
interface JourneyStageProps {
  stageNumber: number
  videoSrc?: string
  imageFallback: string
  imageAlt: string
  headline: string
  subtext: string
}
```

### Component Implementation

```tsx
'use client'

import Image from 'next/image'
import { useInView } from '@/hooks/useInView'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

export function JourneyStage({
  stageNumber,
  videoSrc,
  imageFallback,
  imageAlt,
  headline,
  subtext,
}: JourneyStageProps) {
  const { ref, inView } = useInView({ threshold: 0.3 })
  const reducedMotion = useReducedMotion()

  return (
    <section
      ref={ref}
      data-stage={stageNumber}
      className="relative h-screen w-full snap-start overflow-hidden"
    >
      {/* Background Media */}
      {videoSrc && !reducedMotion ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={videoSrc} type="video/webm" />
        </video>
      ) : (
        <Image
          src={imageFallback}
          alt={imageAlt}
          fill
          className="object-cover"
          loading={stageNumber === 0 ? 'eager' : 'lazy'}
          sizes="100vw"
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Content */}
      <div
        className={cn(
          'absolute bottom-20 left-8 right-8 md:left-16 text-white transition-all duration-700',
          inView && !reducedMotion
            ? 'opacity-100 translate-y-0'
            : reducedMotion
            ? 'opacity-100'
            : 'opacity-0 translate-y-8'
        )}
      >
        <h2 className="font-heading text-4xl md:text-6xl lg:text-7xl mb-4 drop-shadow-lg">
          {headline}
        </h2>
        <p
          className={cn(
            'font-body text-lg md:text-xl text-white/90 max-w-2xl transition-all duration-700 delay-200',
            inView && !reducedMotion
              ? 'opacity-100 translate-y-0'
              : reducedMotion
              ? 'opacity-100'
              : 'opacity-0 translate-y-4'
          )}
        >
          {subtext}
        </p>
      </div>
    </section>
  )
}
```

### useInView Hook

```typescript
import { useEffect, useRef, useState } from 'react'

export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
    }, options)

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [options])

  return { ref, inView }
}
```

### Visual Design Requirements

- Full-screen sections (100vh)
- Micro-video or high-res image backgrounds
- Gradient overlay for text readability
- Playfair Display headlines
- Inter body text
- Content positioned in bottom third
- Scroll-triggered fade-in animations

### Performance Considerations

- Lazy load images below fold
- Compress videos (target <2MB each)
- Use WebP with fallbacks
- Intersection Observer for animations
- CSS transforms over position changes

### Accessibility

- NFR28: Alt text on all meaningful images
- NFR34: Respect `prefers-reduced-motion`
- Semantic heading hierarchy (h2 for stage titles)

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Journey-Stage-Design]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Image-Optimization]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
