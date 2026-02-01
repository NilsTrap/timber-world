---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
lastStep: 14
workflowStatus: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-marketing-website-2026-01-04.md'
  - '_bmad-output/planning-artifacts/marketing-website/prd.md'
  - '_bmad-output/project-context.md'
---

# UX Design Specification Timber-International

**Author:** Nils
**Date:** 2026-01-10

---

## Executive Summary

### Project Vision

Timber International is creating an emotion-first B2B website to replace an outdated landing page. The core positioning is "Production Orchestrator" - a company that controls the entire production chain from forest to finished product, conveying trust and accountability.

The website serves dual purposes:
1. **Credibility confirmation** for prospects already contacted by sales agents
2. **First impression** for cold visitors from ads, search, or referrals

The key differentiator is creating a visceral emotional response ("goosebumps") through stunning imagery and powerful slogans at each production stage - unusual for B2B industrial websites, creating significant competitive advantage.

### Target Users

| User | Role | Primary Need | Device Context |
|------|------|--------------|----------------|
| **Erik** | Furniture Producer | Reliable oak panel supply at competitive prices | Desktop |
| **Anna** | Installer | Stock parts OR complete ready-to-install CNC'd packages | Desktop |
| **Marcus** | Sales Agent | Website as credibility proof during client visits | Tablet |
| **Katri** | Content Manager | Weekly inventory/pricing updates | Desktop (Admin) |
| **Johan** | Analytics Admin | Performance monitoring and reporting | Desktop (Admin) |
| **Lisa** | Quote Handler | Processing incoming quote requests | Desktop (Admin) |

### Production Journey Framework

The 8-stage production journey is the emotional core of the website. Each stage combines powerful imagery with short, impactful text conveying both emotional values and expertise:

| Stage | Emotional Core | Expertise Message |
|-------|----------------|-------------------|
| **Forest** | Sustainability, stewardship, generational thinking | We plant, nurture, ensure forest continuity |
| **Sawmill** | Skilled craftsmanship, purposeful work | Experienced hands, precision, respect for material |
| **Kilns** | Patience, mastery, perfection through time | Slow drying, best programs, uniform colors, no internal stress |
| **Elements/Panels** | Human touch, attention to detail | Manual selection, visual color sorting, defect removal |
| **CNC** | Craft meets technology | Human values + latest machinery, precision to spec |
| **Finishing** | Care for health & planet | Sustainable ecological finishes, no harmful adhesives |
| **Quality Control** | Accountability, zero compromise | Each product inspected before packing |
| **Delivery** | Trust, reliability | Client receives exactly what ordered |

**Copywriting Note:** Slogans require dedicated creative workstream - emotional, somewhat poetic, 1-2 sentences max per stage. Parallel effort to UX design.

### Key Design Challenges

1. **Balancing Emotion and Function** - Seamless transition from "goosebumps" experience to efficient B2B tooling
2. **8-Stage Journey Pacing** - Each stage must land emotionally without the journey feeling endless
3. **Complex Product Filtering** - Many filter dimensions must stay usable without overwhelming
4. **Dual Quote Paths** - Stock vs. custom production paths need clear guidance
5. **Multi-Language Emotional Content** - 8 languages with auto-translation; emotional slogans may need special handling
6. **Responsive Scaling** - Desktop-first but tablet-ready for sales agent use cases

### Design Opportunities

1. **Competitive Differentiation** - Emotion-first approach stands out dramatically in sterile B2B timber industry
2. **Trust Through Transparency** - Open stock pricing + visual production journey = radical transparency
3. **Sales Enablement UX** - Optimizing for tablet use during client meetings (Marcus persona)
4. **Progressive Disclosure** - Build trust through journey before revealing functional tools

## Core User Experience

### Defining Experience

**The ONE Feeling:** After completing the production journey, visitors should feel a strong desire to work with Timber International.

This feeling is built on these underlying convictions:
- **Trust** - These people are reliable and accountable
- **Expertise** - They truly know what they're doing
- **Control** - They manage the entire process from forest to finished product
- **Capability** - They can make anything I need from oak
- **Value** - High quality at competitive prices

### Platform Strategy

| Aspect | Decision |
|--------|----------|
| Primary Platform | Web (desktop-first) |
| Secondary | Tablet (sales agents on-site), Mobile (responsive) |
| Offline | Not required |
| Special Capabilities | Camera for image upload, microphone for voice input |

### Effortless Interactions

**Primary Focus: Quote Request Submission**

The quote request must be completely effortless with dual input modes:

| Mode | Experience |
|------|------------|
| **Conversational (Voice/Chat)** | Speak or type to AI chatbot → voice-to-text → chatbot responds (voice + text) → auto-fills form → confirm and submit |
| **Traditional Form** | Direct form input for users who prefer typing or can't use voice |

Both modes always available - user chooses based on environment and preference.

**Chatbot Dual Purpose:**
- **Quote Requests:** Collect specs, provide pricing
- **General Questions:** Answer immediately if possible, or capture and forward to team for follow-up

**Catalog Role:** Secondary to quote conversion. Demonstrates inventory depth and capability, reinforcing "we can make anything you need."

### Critical Success Moments

| Moment | What Happens | Success Indicator |
|--------|--------------|-------------------|
| **Journey Completion** | Visitor scrolls through all 8 production stages | Clicks "View Products" or "Request Quote" |
| **Quote Submission** | Visitor submits quote with contact details | Name, phone, company captured |
| **Any Inquiry Captured** | Even simple questions result in contact capture | Lead generated for follow-up |

**Primary Success Metric:** Quote submissions (stock or custom products)

### Experience Principles

1. **Journey Creates Desire** - The production journey builds trust, expertise recognition, and value perception that makes visitors actively want to engage
2. **Quote Above All** - Every design decision makes quote submission easier; catalog serves the quote
3. **Speak or Type, Your Choice** - Quote works equally via conversational AI or traditional form
4. **Low Floor, High Ceiling** - Simple questions welcome ("what panels do you make?"); detailed specs get better responses
5. **Capability on Display** - Journey + catalog communicate "we can make anything you need from oak"
6. **Always Answered** - No inquiry goes unanswered; chatbot provides immediate response or promises follow-up

## Desired Emotional Response

### Primary Emotional Goals

**Ultimate Goal:** "I want to work with them" → leading to "I don't have to worry about raw materials anymore"

**Supporting Emotions:**
- **Awe** - First impression creates wonder, sets Timber International apart
- **Trust** - Production journey builds genuine confidence in capability
- **Certainty** - Clear, specific response commitments remove anxiety
- **Peace of Mind** - Long-term partnership means supply problem solved

### Emotional Journey Mapping

| Stage | Desired Emotion | Trigger |
|-------|-----------------|---------|
| **First Impression** | Awe, intrigue, "this is different" | Full-screen forest imagery, powerful slogan |
| **Production Journey** | Growing trust, respect, connection | Powerful images + emotional slogans at each stage |
| **Journey Completion** | Conviction: "I want to work with them" | Cumulative impact of 8-stage story |
| **Catalog Browse** | Confidence, capability assurance | Inventory depth, transparent pricing, clear filters |
| **Quote Start** | Ease, "this is simple" | Friendly chatbot, clear options, no complexity |
| **Quote Completion** | Accomplishment, anticipation | Specific response time commitment |
| **Return Visit** | Familiarity, "my supplier" | Consistent experience, recognized value |

### Micro-Emotions

| Maximize | Avoid |
|----------|-------|
| **Confidence** - "I know what I'm getting" | **Confusion** - "What do I do next?" |
| **Trust** - "These people are genuine" | **Skepticism** - "Is this too good to be true?" |
| **Ease** - "That was simple" | **Anxiety** - "This feels complicated" |
| **Certainty** - "I'll hear back by Monday" | **Uncertainty** - "Will they even respond?" |
| **Relief** - "My supply problem is solved" | **Worry** - "Can I rely on them?" |

### Design Implications

**Error Prevention Over Error Handling:**
- Form cannot fail - only ask what's needed, accept any valid input
- Catalog shows only available inventory - no "not found" scenarios
- Checkbox filters instead of free-text search - impossible to get zero results

**Dynamic Response Commitments:**

| Submission Time | Confirmation Message |
|-----------------|---------------------|
| Standard quote, complete data | "We'll respond within 1 hour" |
| Monday-Thursday | "We'll respond by tomorrow evening" |
| Friday | "We'll respond by Monday end of day" |
| Complex request | "We'll respond within 24 hours (next working day)" |

**Tone Guidelines:**
- Technical errors: Friendly, supportive ("Something went wrong on our end - please try again")
- Confirmations: Warm but specific ("Got it! We'll get back to you by [specific time]")
- All messaging: Professional warmth, never corporate coldness

### Emotional Design Principles

1. **Awe to Action** - Wonder → Conviction → Intent captured
2. **Impossible to Fail** - Design eliminates user error entirely
3. **Speed as Care** - Fast responses = respect for their business
4. **Certainty Over Promises** - Specific commitments ("Monday evening") not vague ("soon")
5. **Peace of Mind** - Ultimate goal: they stop worrying about supply

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Immersive Scroll / Story Experiences:**

| Product | What They Do Well | Applicable Pattern |
|---------|-------------------|-------------------|
| **Apple Product Pages** | Full-screen imagery, scroll-triggered reveals, one message per screen, minimal text | Production journey scroll mechanics |
| **Patagonia** | Environmental values woven throughout, authentic sourcing stories | Sustainability messaging embedded in journey |
| **Rivian** | Nature imagery + premium product, emotional outdoor connection | Forest hero treatment, premium feel |

**B2B Done Beautifully:**

| Product | What They Do Well | Applicable Pattern |
|---------|-------------------|-------------------|
| **Stripe** | Technical capability + approachable tone, confident messaging | Professional warmth, not corporate coldness |
| **Linear** | Modern B2B with personality, fast and responsive | B2B can feel premium and engaging |

**Effortless Quote/Inquiry Experiences:**

| Product | What They Do Well | Applicable Pattern |
|---------|-------------------|-------------------|
| **Typeform** | Conversational flow, one question at a time, progress indication | Quote form feels like conversation |
| **Intercom** | AI chatbot that guides without annoying, quick answers | Chatbot quote system approach |
| **Calendly** | Minimal steps, clear confirmation | "That was easy" feeling |

**Catalog/Filter Experiences:**

| Product | What They Do Well | Applicable Pattern |
|---------|-------------------|-------------------|
| **IKEA** | Sidebar checkbox filters, clear product grid, price transparency | Product catalog layout |

### Transferable UX Patterns

**Core Patterns to Adopt:**

| Pattern | Source | Application |
|---------|--------|-------------|
| **Scroll-triggered reveals** | Apple | Text/images appear as user scrolls through journey stages |
| **One message per screen** | Apple | Each production stage = one focused emotional/expertise message |
| **Micro-video backgrounds** | Modern web | 1-2 second looping videos for hero and stage imagery, subtle movement |
| **Horizontal galleries in vertical scroll** | Custom | Swipe left-right within stages to explore 5-6 images without lengthening journey |
| **Values woven in** | Patagonia | Sustainability embedded in journey, not separate page |
| **Nature as hero** | Rivian | Forest imagery at full scale, premium feel |
| **Conversational forms** | Typeform | Quote form feels like conversation, not spreadsheet |
| **Helpful chatbot** | Intercom | AI guides to completion, doesn't block or frustrate |
| **Sidebar filters** | IKEA | Left-panel checkboxes, results on right, price visible |
| **Professional warmth** | Stripe | Confident and capable, but not cold |

**Production Journey - Horizontal Gallery Strategy:**

| Stage | Gallery Type | Content |
|-------|--------------|---------|
| Forest | Micro-video | Trees, seasons, sustainability |
| Sawmill | Micro-video + Horizontal gallery | Cutting operations, machinery variety |
| Kilns | Micro-video | Drying process, steam, monitoring |
| Elements/Panels | Micro-video + Horizontal gallery | Manual selection, color sorting process |
| CNC | Micro-video + Horizontal gallery | Different operations, precision details |
| Finishing | Micro-video + Horizontal gallery | Varnishing, waxing, finish options |
| Quality Control | Micro-video | Inspection, measuring, verification |
| Delivery | Static or micro-video | Clean, final moment |

### Anti-Patterns to Avoid

| Anti-Pattern | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Stock photography** | Feels fake, breaks trust | Use real production photos/videos |
| **Corporate jargon** | "Solutions" and "synergy" kill authenticity | Plain, confident language |
| **Endless forms** | Users abandon complex forms | Minimal required fields, conversational flow |
| **Hidden pricing** | Creates skepticism | Show stock prices openly |
| **Aggressive chat popups** | Annoying, feels desperate | Let user initiate chatbot |
| **Dense text walls** | Kills visual impact | Visual-first, minimal text per stage |
| **Slow-loading images** | Destroys scroll experience | Aggressive optimization, lazy loading |
| **Autoplay audio** | Universally hated | Video with no audio, or user-initiated |

### Design Inspiration Strategy

**Adopt Directly:**
- Apple-style scroll-triggered content reveals
- IKEA-style sidebar checkbox filters
- Typeform conversational form patterns
- Micro-video backgrounds for movement and life

**Adapt for Timber-International:**
- Horizontal galleries only where content depth warrants (not every stage)
- Patagonia's values integration but with B2B professional tone
- Chatbot as optional helper, not gatekeeper

**Explicitly Avoid:**
- Any pattern that slows page load
- Anything that feels "salesy" or corporate
- Complexity in the quote process
- Hiding prices or inventory information

## Design System Foundation

### Design System Choice

**Selected System:** shadcn/ui + Tailwind CSS 4 (with Radix UI primitives)

**Category:** Themeable System - maximum flexibility with proven foundations

This choice was established in the project architecture and aligns perfectly with UX requirements:
- Full visual customization for emotion-first B2B approach
- Accessible components via Radix primitives (WCAG compliance built-in)
- Performance-optimized (Tailwind purges unused CSS)
- Modern React 19 compatibility with Server Components support

### Rationale for Selection

| Factor | How shadcn/ui + Tailwind Delivers |
|--------|-----------------------------------|
| **Visual Uniqueness** | Fully customizable - own the code, not locked to a predefined look |
| **Emotion-First Design** | Total control over imagery, spacing, typography, animations |
| **Development Speed** | Pre-built accessible components, copy-paste architecture |
| **Accessibility** | Radix primitives have keyboard navigation, focus management, ARIA built-in |
| **Performance** | Utility-first CSS with aggressive purging, minimal bundle |
| **Animation Support** | Compatible with Framer Motion or GSAP for scroll-triggered effects |
| **Team Productivity** | Well-documented, large community, TypeScript-first |

### Implementation Approach

**Base Layer:** Tailwind CSS 4 for all styling
- Custom color palette (forest/wood tones)
- Custom spacing scale (generous for premium feel)
- Custom typography scale (display + body fonts)
- Responsive breakpoints (desktop-first with tablet/mobile)

**Component Layer:** shadcn/ui components
- Button, Input, Select, Checkbox, Dialog, Toast, etc.
- Heavily themed to match Timber International brand
- Accessible by default

**Animation Layer:** Framer Motion or GSAP
- Scroll-triggered reveals for production journey
- Micro-interactions for delight
- Horizontal gallery transitions

### Customization Strategy

**Theme Tokens:**

| Token Category | Customization |
|----------------|---------------|
| **Colors** | Forest greens, oak browns, cream whites, charcoal accents |
| **Typography** | Premium serif for headings, clean sans for body |
| **Spacing** | Generous whitespace, breathing room between sections |
| **Borders** | Subtle, organic curves where appropriate |
| **Shadows** | Soft, natural shadows for depth |

**Custom Components Required:**

| Component | Purpose | Base |
|-----------|---------|------|
| **JourneyStage** | Full-screen production stage with micro-video, slogan, scroll trigger | Custom |
| **HorizontalGallery** | Swipeable image gallery within vertical scroll | Custom |
| **ChatbotInterface** | Voice + text quote conversation UI | Custom + shadcn Dialog |
| **ProductFilter** | Left sidebar with checkbox filter groups | shadcn Checkbox + custom layout |
| **QuoteForm** | Conversational form with progress indication | shadcn Form + custom flow |
| **ProductCard** | Catalog item display with pricing | shadcn Card + custom styling |
| **ConfirmationCard** | Post-submission confirmation with timeline | Custom |

## Defining User Experience

### The Defining Experience

**Core Interaction:** The Production Journey Scroll

> "Scroll through our story, then tell us what you need"

The 8-stage visual storytelling experience transforms skeptical visitors into engaged prospects. This is what users will describe to others: *"Their website shows you exactly how they make everything, from the forest to the final product."*

**Why This Defines Success:**

| If We Nail This... | Everything Else Follows |
|-------------------|------------------------|
| Visitor feels trust | Willing to share contact info |
| Visitor sees capability | Believes we can make what they need |
| Visitor feels values alignment | Wants long-term relationship |
| Visitor is emotionally engaged | Quote form feels natural, not a hurdle |

### User Mental Model

**Current Reality:**
- B2B supplier sites are boring, sterile, transactional
- "All suppliers claim quality" - marketing skepticism is high
- Quote processes mean endless email chains and delays

**User Expectations:**
- More of the same - basic product lists, contact forms
- Marketing speak they'll have to see through
- Friction before getting real answers

**Our Opportunity:**
- Surprise with emotional storytelling
- Show don't tell - visual proof of process
- Effortless, immediate, conversational quote experience

### Success Criteria

| Criteria | Target | Why It Matters |
|----------|--------|----------------|
| **Journey scroll completion** | 70%+ complete all 8 stages | Proves engagement, not bounce |
| **Time on journey page** | 2-3 minutes | Engaged viewing, not skimming |
| **CTA click-through** | 30%+ click Quote or Products | Journey creates action intent |
| **Quote completion rate** | 80%+ who start, finish | Effortless experience confirmed |
| **Emotional differentiation** | "Unlike other supplier sites" | Core positioning achieved |

### Novel UX Patterns

| Element | Pattern Type | Implementation |
|---------|--------------|----------------|
| **Full-screen scroll story** | Established (Apple) | Adopt directly |
| **Micro-video backgrounds** | Modern established | Optimize for performance |
| **Horizontal galleries in vertical scroll** | Novel combination | Clear affordance: arrows + dots |
| **8-stage B2B production narrative** | Novel for industry | Key differentiator |
| **Voice-enabled quote chatbot** | Emerging | Always offer type alternative |

**Discoverability:** No user manual needed. Novel patterns use familiar affordances (arrows, microphone icons, progress dots) so users discover naturally.

### Experience Mechanics

**1. Initiation**
- Homepage loads with full-screen forest hero (micro-video)
- Powerful slogan fades in
- Subtle scroll indicator: arrow or "Scroll to explore our story"

**2. Stage Interaction**
- Scroll triggers stage transitions (smooth fade/slide)
- Each stage: micro-video + slogan + expertise line
- Horizontal swipe available on gallery stages (arrows visible)
- Progress indicator shows position (e.g., "3 of 8" or dot navigation)

**3. Feedback**
- Smooth animations confirm scroll is registering
- Content appears at natural reading pace
- Stage transitions feel intentional, not jarring
- Gallery swipe shows next image peek

**4. Completion**
- Final stage (Delivery) transitions to CTA zone
- Two clear paths: "View Products" | "Request Quote"
- Emotional momentum carries directly into action
- No dead-end - always a clear next step

## Visual Design Foundation

### Color System

**Concept:** "Forest to Finished" - colors that evoke the journey from raw nature to refined product

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary** | Deep Forest Green | `#1B4332` | CTAs, key actions, brand anchor |
| **Secondary** | Warm Oak | `#8B5A2B` | Accents, highlights, warmth |
| **Neutral Dark** | Charcoal | `#2D3436` | Text, headings, professional tone |
| **Neutral Light** | Warm Cream | `#FAF6F1` | Backgrounds, breathing room |
| **Neutral Mid** | Stone Gray | `#6B7280` | Secondary text, borders |
| **Accent** | Soft Gold | `#C9A227` | Premium touches, special highlights |
| **Success** | Growth Green | `#22C55E` | Confirmations, positive states |
| **Error** | Warm Red | `#DC2626` | Errors (used sparingly) |

**Palette Personality:**
- Natural, not artificial
- Premium, not cheap
- Warm, not cold corporate
- Grounded, not flashy

**Tailwind Theme Tokens:**
```css
colors: {
  forest: { 500: '#1B4332', 600: '#143726', 400: '#2D5A45' },
  oak: { 500: '#8B5A2B', 600: '#704822', 400: '#A16E3D' },
  cream: { 50: '#FAF6F1', 100: '#F5EDE3' },
  charcoal: { 900: '#2D3436', 800: '#3D4548' },
  stone: { 500: '#6B7280', 400: '#9CA3AF' },
  gold: { 500: '#C9A227' }
}
```

### Typography System

**Concept:** "Crafted & Clear" - premium feel with excellent readability

**Font Pairing:**

| Role | Font | Fallback | Rationale |
|------|------|----------|-----------|
| **Display/Headlines** | Playfair Display | Georgia, serif | Elegant serif, premium feel, pairs well with nature imagery |
| **Body/UI** | Inter | system-ui, sans-serif | Modern, highly readable, professional, excellent for UI |
| **Monospace** | JetBrains Mono | monospace | For product specs, dimensions, technical data |

**Type Scale:**

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `hero` | 72-96px | 1.1 | 700 | Homepage slogan only |
| `h1` | 48-56px | 1.2 | 700 | Page titles, journey stage slogans |
| `h2` | 32-40px | 1.25 | 600 | Section headers |
| `h3` | 24-28px | 1.3 | 600 | Subsections, card titles |
| `body-lg` | 18-20px | 1.6 | 400 | Journey expertise text, important content |
| `body` | 16px | 1.6 | 400 | General content, UI text |
| `small` | 14px | 1.5 | 400 | Captions, metadata, helper text |
| `xs` | 12px | 1.4 | 500 | Labels, badges |

### Spacing & Layout Foundation

**Concept:** "Breathe" - generous whitespace signals premium quality

**Spacing Scale (8px base):**

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Inline elements, tight groups |
| `md` | 16px | Standard component padding |
| `lg` | 24px | Card padding, form groups |
| `xl` | 32px | Section internal spacing |
| `2xl` | 48px | Between components |
| `3xl` | 64px | Between sections |
| `4xl` | 96px | Major section breaks |
| `section` | 120-160px | Between page sections |

**Layout Patterns:**

| Context | Approach |
|---------|----------|
| **Homepage/Journey** | Full-bleed imagery, 100vh stages, minimal navigation chrome |
| **Product Catalog** | Left sidebar (280px fixed) + fluid content grid (3-4 columns) |
| **Quote Form** | Centered container, max-width 640px, focused single-column |
| **Resources/Content** | Prose container (max-width 720px), generous side margins |
| **Navigation** | Sticky header, minimal height, transparent over hero |

**Grid System:**
- 12-column grid for flexibility
- Gutter: 24px (desktop), 16px (mobile)
- Container max-width: 1280px
- Full-bleed breakout for imagery

### Accessibility Considerations

**Color Accessibility:**

| Combination | Contrast Ratio | Status |
|-------------|----------------|--------|
| Charcoal on Cream | 12.5:1 | ✅ AAA |
| Forest Green on Cream | 8.2:1 | ✅ AAA |
| White on Forest Green | 8.2:1 | ✅ AAA |
| Stone on Cream | 4.6:1 | ✅ AA |

**Interactive Elements:**
- Focus rings: 2px solid with offset, high contrast
- Touch targets: minimum 44x44px
- Hover states: subtle color shift + cursor change
- Active states: slight scale or color intensification

**Typography Accessibility:**
- Minimum body text: 16px
- Respects user font-size preferences (rem units)
- Line height minimum 1.5 for body text
- Maximum line length: 75 characters for readability

**Motion Accessibility:**
- Respect `prefers-reduced-motion` for scroll animations
- Provide static alternatives for micro-videos
- No flashing content above 3Hz

## Design Direction

### Design Direction Chosen

**Direction A: "Full Immersion"**

A maximally immersive visual approach where photography and video dominate the experience, with text elegantly overlaid. This creates the emotional impact and differentiation that sets Timber International apart from typical B2B industrial websites.

### Design Directions Explored

| Direction | Approach | Verdict |
|-----------|----------|---------|
| **A: Full Immersion** | 100% full-bleed imagery, text overlaid | ✅ **Selected** - Maximum emotional impact |
| **B: Split Canvas** | 50/50 image and content panels | Not selected - reduces visual impact |
| **C: Floating Cards** | Content in cards over dark imagery | Not selected - too separated from imagery |
| **D: Minimal Frame** | Thin borders, very clean | Not selected - too architectural, less warm |

### Design Rationale

**Why Full Immersion Works for Timber International:**

1. **Maximizes Emotional Impact** - Full-screen forest and production imagery creates the "goosebumps" effect
2. **Apple-Style Differentiation** - Aligns with proven scroll-storytelling patterns
3. **Photography as Hero** - Best showcases the stunning production journey visuals
4. **B2B Differentiation** - "Unlike any supplier site I've seen"
5. **Scroll-Triggered Reveals** - Text appearing over imagery creates cinematic experience

### Implementation Approach

**Journey Stages (Full Immersion):**

| Element | Treatment |
|---------|-----------|
| **Background** | Full-bleed micro-video or high-res image, 100vh height |
| **Overlay** | Subtle gradient (bottom 30%) for text readability |
| **Headline** | Large Playfair Display, white or cream, centered or bottom-aligned |
| **Subtext** | Inter, smaller, expertise message below headline |
| **Scroll Indicator** | Subtle arrow or dots, fades after first scroll |
| **Navigation** | Transparent initially, appears on scroll-up |

**Text Overlay Strategy:**

| Stage Type | Overlay Approach |
|------------|------------------|
| Dark imagery (forest, kilns) | White text, minimal overlay needed |
| Bright imagery (sawmill, panels) | Darker gradient overlay, white text |
| Mixed imagery | Adaptive gradient based on image analysis |

**Navigation Behavior:**

| State | Navigation Style |
|-------|------------------|
| Initial (hero visible) | Transparent, white logo + menu |
| Scrolling down | Navigation fades out completely |
| Scrolling up | Navigation slides in, semi-transparent dark |
| Non-journey pages | Solid cream background, dark text |

**CTA Placement:**

| Location | CTA Style |
|----------|-----------|
| End of journey | Two prominent buttons: "View Products" / "Request Quote" |
| Persistent (optional) | Floating "Request Quote" button, bottom-right, subtle |
| Navigation | "Get Quote" button always visible in header |

### Visual Specifications

**Imagery Requirements:**

| Requirement | Specification |
|-------------|---------------|
| Aspect ratio | 16:9 minimum for landscape, can be taller |
| Resolution | Minimum 1920x1080, 4K preferred |
| Video format | WebM + MP4 fallback, max 5MB per clip |
| Video length | 2-4 seconds, seamless loop |
| Color grading | Consistent warmth across all stages |

**Overlay Gradients:**

```css
/* Standard bottom gradient */
.stage-overlay {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.3) 30%,
    transparent 60%
  );
}

/* For bright imagery */
.stage-overlay-strong {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.5) 40%,
    rgba(0, 0, 0, 0.2) 70%,
    transparent 100%
  );
}
```

**Animation Timing:**

| Animation | Duration | Easing |
|-----------|----------|--------|
| Stage transition | 600-800ms | ease-out |
| Text fade-in | 400ms | ease-out |
| Gallery slide | 300ms | ease-in-out |
| Navigation show/hide | 200ms | ease |

## User Journey Flows

### Journey 1: Discovery to Quote (Erik - Furniture Producer)

**Goal:** Find new supplier → Build trust → Request production quote

**Flow:**
1. Agent sends website link → Erik opens homepage
2. First impression: full-screen forest hero creates intrigue
3. Scrolls through 8-stage production journey
4. Journey complete → Clicks "View Products" or "Request Quote"
5. Browses catalog, finds spec, sees stock price
6. Clicks "Request Quote" for production pricing
7. Uses chatbot or form to provide specs
8. Submits → Confirmation with specific response time
9. Receives quote → Places first order

**Critical Moments:**
- Journey must create "I want to work with them" conviction
- Catalog must show his exact spec is available
- Quote submission must feel effortless

### Journey 2: Custom Project Quote (Anna - Installer)

**Goal:** Submit detailed CNC project specs → Get complete package quote

**Flow:**
1. Views journey, notes CNC capability
2. Clicks "Request Quote" → Selects "Custom Project"
3. Enters project details (14-step staircase)
4. Specifies dimensions, wood species, finish
5. Uploads drawings/images (optional)
6. Adds delivery address
7. Submits → Confirmation "Response within 24 hours"
8. Receives detailed quote with timeline
9. Places order → Receives ready-to-install packages

**Critical Moments:**
- Must clearly communicate CNC/custom capability
- File upload must be frictionless
- Complex quotes need acknowledgment + timeline

### Journey 3: Sales Enablement (Marcus - Sales Agent)

**Goal:** Use website as credibility tool during prospect meetings

**Flow:**
1. Opens website on tablet during meeting
2. Shows forest hero: "Let me show you where your panels come from"
3. Scrolls journey with prospect watching
4. Opens catalog: "Here's your spec - see our stock price"
5. Either: Submits quote on spot OR sends follow-up link
6. Gets notified when prospect submits quote
7. Follows up with personalized response

**Critical Moments:**
- Must work perfectly on tablet
- Journey must impress prospect visually
- Easy to share specific product/quote links

### Journey 4: Quick Stock Check (Any Buyer)

**Goal:** Quickly check inventory and pricing for known need

**Flow:**
1. Lands on site → Clicks "Products" in nav (skips journey)
2. Uses filters: species, dimensions, quality
3. Results show with stock prices and availability
4. Selects products → Adds to quote
5. Specifies quantity and delivery location
6. Submits → Receives quote with transport cost

**Critical Moments:**
- Must be able to skip journey if desired
- Filters must be fast and intuitive
- Stock prices must be immediately visible

### Journey Patterns

**Navigation Patterns:**

| Pattern | Implementation |
|---------|----------------|
| **Skip to Action** | "Products" and "Get Quote" always in nav |
| **Progressive Reveal** | Journey content appears on scroll |
| **Persistent CTA** | Floating quote button after journey |
| **Easy Return** | Logo always returns to homepage |

**Decision Patterns:**

| Pattern | Implementation |
|---------|----------------|
| **Dual Path Quote** | Clear "Stock" vs "Custom Project" fork |
| **Input Mode Choice** | Voice/chat toggle always visible |
| **Filter by Exclusion** | All options checked, uncheck to exclude |
| **Progressive Complexity** | Basic first, "Add details" optional |

**Feedback Patterns:**

| Pattern | Implementation |
|---------|----------------|
| **Journey Progress** | Dot indicators showing stage position |
| **Quote Progress** | Step counter in form, progress bar in chat |
| **Confirmation Promise** | Specific time: "By tomorrow evening" |
| **Inline Validation** | Real-time field validation |

### Flow Optimization Principles

**Minimize Steps to Value:**
- Direct quote: 3 steps (Open → Describe → Submit)
- Via catalog: 4 steps (Filter → Select → Details → Submit)
- Full journey: 10 steps (8 stages → CTA → Submit)

**Reduce Cognitive Load:**
- One decision per screen
- Familiar checkbox filter patterns
- Chatbot asks one question at a time

**Clear Progress Indicators:**
- Journey: Visual stage counter
- Form: "Step 1 of 3"
- Chat: Progress bar fills as info collected

**Moments of Delight:**
- Smooth journey-to-CTA transition
- Warm, specific confirmation message
- "Faster than expected" for quick responses

**Error Recovery:**
- Inline validation hints
- Auto-retry on network errors
- Draft saving for incomplete quotes
- Human escalation from chatbot

## Component Strategy

### Design System Components (shadcn/ui)

**Use Directly:**

| Component | Usage |
|-----------|-------|
| Button | CTAs, submissions, actions |
| Input | Form fields, quote inputs |
| Checkbox | Filters, options |
| Select | Dropdowns (species, quality) |
| Dialog | Quote modal, confirmations |
| Card | Product cards, info panels |
| Toast | Notifications |
| Form | Form structure, validation |
| Textarea | Project descriptions |
| Skeleton | Loading states |
| Progress | Journey/quote progress |
| Badge | Stock status, labels |

**Customize:**

| Component | Customization |
|-----------|---------------|
| Navigation Menu | Transparent/solid scroll states |
| Accordion | Filter group expansion |
| Tabs | Quote type selection |

### Custom Components

#### JourneyStage

**Purpose:** Display one production journey stage with immersive visual impact

**Anatomy:**
- Background layer (micro-video or high-res image)
- Gradient overlay (bottom 30-40%)
- Headline (Playfair Display, large)
- Subtext (Inter, expertise message)
- Progress indicator (dots)
- Optional: HorizontalGallery trigger

**States:**
- `loading` - Skeleton/blur while media loads
- `active` - Currently in viewport, text visible
- `passed` - Scrolled past, may dim slightly
- `upcoming` - Below viewport, not yet triggered

**Props:**
```typescript
interface JourneyStageProps {
  stageNumber: number;
  videoSrc?: string;
  imageFallback: string;
  headline: string;
  subtext: string;
  hasGallery?: boolean;
  galleryImages?: string[];
}
```

**Accessibility:**
- `aria-label="Production stage {n}: {headline}"`
- Video pauses when `prefers-reduced-motion: reduce`
- Static image fallback always available

---

#### HorizontalGallery

**Purpose:** Show multiple images within a journey stage via horizontal navigation

**Anatomy:**
- Image container (full width of stage)
- Left/right navigation arrows
- Dot indicators below
- Image counter (optional: "2 of 6")

**States:**
- `default` - First image shown
- `swiping` - During touch/mouse drag
- `at-start` - Left arrow hidden/disabled
- `at-end` - Right arrow hidden/disabled

**Props:**
```typescript
interface HorizontalGalleryProps {
  images: { src: string; alt: string }[];
  showCounter?: boolean;
  autoPlay?: boolean;
  interval?: number;
}
```

**Accessibility:**
- `aria-roledescription="carousel"`
- Arrow key navigation support
- Images have descriptive alt text

---

#### ChatbotInterface

**Purpose:** Conversational quote request via text or voice input

**Anatomy:**
- Message history area (scrollable)
- User message bubbles (right-aligned)
- Bot message bubbles (left-aligned)
- Input field with send button
- Voice toggle button (microphone icon)
- Progress bar (quote completion %)

**States:**
- `idle` - Waiting for user input
- `listening` - Voice input active (pulsing mic)
- `processing` - AI generating response
- `complete` - All required info collected

**Props:**
```typescript
interface ChatbotInterfaceProps {
  initialMessage: string;
  requiredFields: QuoteField[];
  onComplete: (quoteData: QuoteData) => void;
  onEscalate: () => void;
}
```

**Accessibility:**
- `aria-live="polite"` for new messages
- Voice button: `aria-label="Start voice input"`
- Keyboard: Enter to send, Escape to close

---

#### ProductFilter

**Purpose:** Filter product catalog by multiple dimensions

**Anatomy:**
- Filter header with active count badge
- Collapsible filter groups
- Checkbox lists within groups
- "Clear all filters" button

**Filter Groups:**
- Species (Oak, etc.)
- Width (mm ranges)
- Length (mm ranges)
- Thickness (mm options)
- Quality grade
- Type (FJ/FS)
- Moisture content
- Finish
- FSC certification

**States:**
- Group: `expanded` / `collapsed`
- Filter: `checked` / `unchecked`
- Overall: `filtering` (loading) / `ready`

**Props:**
```typescript
interface ProductFilterProps {
  filters: FilterGroup[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  onClearAll: () => void;
}
```

**Accessibility:**
- Keyboard navigable (Tab through groups, Space to toggle)
- Filter changes announced via `aria-live`

---

#### ProductTable

**Purpose:** Display filterable product list with pricing and selection

**Anatomy:**
- Header row (sortable columns)
- Product rows with: spec, dimensions, quality, stock, prices
- Selection checkbox per row
- Price columns: per m³, per piece, per m²

**Columns:**

| Column | Sortable | Width |
|--------|----------|-------|
| Select | No | 48px |
| Product | Yes | flex |
| Dimensions | Yes | 120px |
| Quality | Yes | 80px |
| Stock | Yes | 80px |
| €/m³ | Yes | 100px |
| €/piece | Yes | 100px |
| €/m² | Yes | 100px |

**States:**
- `loading` - Skeleton rows
- `empty` - "No products match filters" message
- `ready` - Products displayed
- Row: `default` / `selected` / `hover`

**Props:**
```typescript
interface ProductTableProps {
  products: Product[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
}
```

---

#### QuoteConfirmation

**Purpose:** Confirm quote submission with specific response timeline

**Anatomy:**
- Success icon (checkmark in circle)
- Thank you headline
- Timeline promise (dynamic)
- What happens next list
- Return to homepage/catalog buttons

**Timeline Logic:**

| Condition | Message |
|-----------|---------|
| Standard quote, weekday before 4pm | "We'll respond by this evening" |
| Standard quote, weekday after 4pm | "We'll respond by tomorrow evening" |
| Standard quote, Friday after 4pm | "We'll respond by Monday evening" |
| Complex/custom quote | "We'll respond within 24 hours" |
| Weekend submission | "We'll respond by Monday evening" |

**Props:**
```typescript
interface QuoteConfirmationProps {
  quoteType: 'standard' | 'custom';
  submissionTime: Date;
  quoteId: string;
}
```

### Component Implementation Strategy

**Build Approach:**
1. Start with shadcn/ui primitives
2. Compose custom components using design tokens
3. Ensure all components follow accessibility patterns
4. Create Storybook stories for each component
5. Write unit tests for interaction logic

**Shared Patterns:**
- All components use Tailwind theme tokens
- Consistent loading states (Skeleton)
- Consistent error states (red border + message)
- Consistent success states (green + toast)

### Implementation Roadmap

**Phase 1 - MVP Critical:**
- [ ] JourneyStage (homepage)
- [ ] ProductFilter (catalog)
- [ ] ProductTable (catalog)
- [ ] QuoteConfirmation (quote flow)
- [ ] Basic quote form (shadcn Form)

**Phase 2 - Quote Enhancement:**
- [ ] ChatbotInterface
- [ ] Voice input integration
- [ ] Progress indicators

**Phase 3 - Polish:**
- [ ] HorizontalGallery
- [ ] Advanced scroll animations
- [ ] Micro-interactions

## UX Consistency Patterns

### Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| **Primary** | Forest green bg (`#1B4332`), white text | Main CTAs: "Request Quote", "Submit", "View Products" |
| **Secondary** | White bg, forest green border/text | Alternative actions: "Back", "Cancel", "Learn More" |
| **Ghost** | Transparent, forest green text | Tertiary: "Skip", "Maybe Later", inline links |
| **Destructive** | Red bg, white text | Dangerous actions (rarely used) |

**Button Sizes:**

| Size | Height | Usage |
|------|--------|-------|
| `lg` | 48px | Hero CTAs, primary page actions |
| `md` | 40px | Standard buttons, forms |
| `sm` | 32px | Inline actions, table rows |

**Button States:**
- `default` - Normal appearance
- `hover` - Slight darken/lighten
- `active` - Pressed, slight scale down
- `disabled` - 50% opacity, no pointer
- `loading` - Spinner replaces text, disabled

### Feedback Patterns

**Toast Notifications:**

| Type | Background | Icon | Example |
|------|------------|------|---------|
| **Success** | `#22C55E` (green) | Checkmark | "Quote submitted successfully" |
| **Error** | `#DC2626` (red) | X circle | "Something went wrong. Please try again." |
| **Warning** | `#F59E0B` (amber) | Alert triangle | "Your session will expire in 5 minutes" |
| **Info** | `#3B82F6` (blue) | Info circle | "Tip: Add more details for a better quote" |

**Toast Behavior:**
- Position: top-right (desktop), top-center (mobile)
- Auto-dismiss: 5 seconds (configurable)
- Include dismiss (X) button
- Stack vertically if multiple
- Slide in from right (desktop) or top (mobile)

**Inline Feedback:**
- Form errors: Red text below field
- Form success: Green checkmark icon
- Required fields: Subtle asterisk (*)

### Form Patterns

**Input States:**

| State | Border | Background | Additional |
|-------|--------|------------|------------|
| Default | `#6B7280` (stone) | `#FAF6F1` (cream) | - |
| Focus | `#1B4332` (forest) | `#FAF6F1` (cream) | 2px border, subtle shadow |
| Error | `#DC2626` (red) | `#FEF2F2` (light red) | Error message below |
| Disabled | `#D1D5DB` (gray) | `#F3F4F6` (gray) | 50% text opacity |
| Valid | `#6B7280` (stone) | `#FAF6F1` (cream) | Green checkmark icon |

**Validation Rules:**
- Validate on blur, not on keystroke
- Show errors immediately below field
- Never block submission for warnings (only errors)
- Required indicator: subtle asterisk after label

**Form Layout:**
- Single column for focused forms (quotes)
- Labels above inputs (not floating labels)
- Spacing: 24px between field groups
- Submit button: right-aligned or centered
- Always show "required" legend if form has required fields

**Form Accessibility:**
- All inputs have associated labels
- Error messages linked via `aria-describedby`
- Focus visible on all interactive elements
- Tab order follows visual order

### Navigation Patterns

**Header Behavior:**

| Context | Style |
|---------|-------|
| Journey page, at hero | Transparent bg, white logo, white text |
| Journey page, scrolling down | Fades out completely (immersive) |
| Journey page, scrolling up | Slides in from top, dark semi-transparent bg |
| Catalog, Resources, other pages | Solid cream bg, dark logo, dark text |

**Header Anatomy:**
- **Left:** Logo (links to homepage)
- **Center:** Main nav (Products, Resources, About, Contact)
- **Right:** Language switcher, "Request Quote" CTA button

**Mobile Navigation:**
- Hamburger icon (right side)
- Opens full-screen overlay
- Large touch targets (min 48px)
- Close button clearly visible
- Current page highlighted

**Scroll Behavior:**
- Header height: 64px (desktop), 56px (mobile)
- Transition duration: 200ms
- Scroll threshold for show/hide: 50px

### Loading States

**Page Loading:**
- Full-screen forest green with centered logo
- Subtle pulse animation on logo
- Transition: fade to content when ready

**Component Loading:**
- Skeleton components matching content shape
- Subtle shimmer animation (left to right)
- Maintain layout stability (no jumps)

**Action Loading:**
- Button: spinner replaces text, button disabled
- Form submit: "Submitting..." with spinner
- Filter change: skeleton rows, filters stay interactive

**Loading Timing:**
- Show skeleton immediately (no delay)
- Minimum display: 300ms (prevent flash)
- Timeout: Show error after 30 seconds

### Empty States

**Catalog - No Results:**
- Icon: Filter with X
- Headline: "No products match your filters"
- Body: "Try adjusting your criteria or clear all filters to see our full catalog."
- Actions: [Clear Filters] [View All Products]

**Quote - No Items:**
- Icon: Document with plus
- Headline: "Your quote is empty"
- Body: "Start by browsing our products or tell us what you need."
- Actions: [Browse Products] [Describe Your Need]

### Modal Patterns

**Modal Types:**

| Type | Size | Usage |
|------|------|-------|
| Small | 400px max-width | Confirmations, simple prompts |
| Medium | 600px max-width | Forms, detailed content |
| Large | 800px max-width | Quote form, complex flows |
| Full-screen | 100% viewport | Image lightbox, mobile modals |

**Modal Behavior:**
- Click outside (backdrop) to close
- Escape key to close
- Focus trapped inside modal
- Background scroll locked
- First focusable element receives focus
- Return focus to trigger element on close

**Modal Animation:**
- Backdrop: fade in (200ms)
- Content: fade + slight scale up (200ms)
- Exit: reverse animation

**Modal Anatomy:**
- Header: Title + Close button (X)
- Body: Scrollable content area
- Footer: Action buttons (right-aligned)

### Interaction Patterns

**Hover States:**
- Buttons: Slight color shift (10% darker/lighter)
- Links: Underline appears
- Cards: Subtle shadow increase
- Table rows: Light background highlight

**Focus States:**
- All interactive elements: 2px forest green outline
- Offset: 2px from element edge
- Never remove focus styles

**Click/Tap Feedback:**
- Buttons: Slight scale down (98%)
- Duration: 100ms

**Transitions:**
- Default duration: 200ms
- Easing: `ease-out` for entrances, `ease-in` for exits
- Never exceed 300ms for UI transitions

## Responsive Design & Accessibility

### Responsive Strategy

**Approach:** Desktop-first with full tablet and mobile support

Timber-International serves B2B users who primarily work on desktop. Sales agents use tablets for client demos. Mobile provides access for quick checks and follow-ups.

| Device | Priority | Primary Users | Scenario |
|--------|----------|---------------|----------|
| **Desktop** | Primary | Erik, Anna, Katri, Johan, Lisa | Office ordering, quote management, admin |
| **Tablet** | High | Marcus (sales agent) | Client demos, on-site presentations |
| **Mobile** | Secondary | All users | Quick checks, notifications, follow-ups |

### Breakpoint Strategy

| Breakpoint | Width | Token |
|------------|-------|-------|
| **Mobile** | < 768px | `sm` |
| **Tablet** | 768px - 1023px | `md` |
| **Desktop** | 1024px - 1279px | `lg` |
| **Large Desktop** | ≥ 1280px | `xl` |

**Layout Adaptations:**

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| **Navigation** | Full horizontal, transparent/solid | Condensed horizontal | Hamburger menu, full-screen overlay |
| **Journey Stages** | 100vh, full experience | 100vh, maintained | 100vh, touch-optimized |
| **Horizontal Gallery** | Arrow nav + swipe | Touch swipe primary | Touch swipe only |
| **Catalog Layout** | Sidebar (280px) + 4-col grid | Collapsible sidebar + 2-col grid | Filter drawer + 1-col cards |
| **ProductTable** | Full table with all columns | Horizontal scroll, sticky first col | Card-based list view |
| **Quote Form** | Centered, 640px max | Centered, 640px max | Full-width, stacked |
| **Chatbot** | Bottom-right floating | Bottom-right floating | Full-screen when active |

**Typography Scaling:**

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Hero headline | 96px | 72px | 48px |
| H1 | 56px | 48px | 36px |
| H2 | 40px | 32px | 28px |
| Body | 16px | 16px | 16px |
| Small | 14px | 14px | 14px |

**Spacing Scaling:**

| Context | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Section spacing | 160px | 120px | 80px |
| Component spacing | 48px | 32px | 24px |
| Card padding | 24px | 24px | 16px |
| Container padding | 48px | 32px | 16px |

### Accessibility Strategy

**Target Compliance:** WCAG 2.1 Level AA

**Rationale:**
- Industry standard for B2B websites
- Legal compliance in EU markets (EN 301 549)
- Demonstrates professional credibility
- Ensures usability for all users including those with disabilities

**Color Accessibility:**

| Requirement | Standard | Timber International |
|-------------|----------|---------------------|
| Normal text contrast | 4.5:1 | ✅ Charcoal on Cream: 12.5:1 |
| Large text contrast | 3:1 | ✅ All combinations exceed |
| Non-text contrast | 3:1 | ✅ Borders, icons meet standard |
| Focus indicators | Visible | ✅ 2px forest green outline |

**Keyboard Navigation:**

| Requirement | Implementation |
|-------------|----------------|
| All interactive elements focusable | Tab order follows visual flow |
| Skip to main content | Skip link at page start |
| Focus trapping in modals | Focus cycles within modal |
| Escape to close | Modals, dropdowns, overlays |
| Arrow key navigation | Galleries, menus, tabs |

**Screen Reader Support:**

| Element | ARIA Implementation |
|---------|---------------------|
| Navigation | `role="navigation"`, `aria-label` |
| Journey stages | `aria-label="Stage X of 8: [title]"` |
| Galleries | `aria-roledescription="carousel"` |
| Forms | Labels, `aria-describedby` for errors |
| Live updates | `aria-live="polite"` for toasts, chat |
| Buttons | Descriptive labels, not just icons |

**Touch & Motor Accessibility:**

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Touch target size | 44x44px minimum | All buttons, links meet standard |
| Spacing between targets | 8px minimum | Prevents accidental taps |
| Gesture alternatives | Buttons for swipe actions | Gallery has arrow buttons |
| No time limits | Or ability to extend | Form sessions don't expire |

**Motion & Cognitive:**

| Requirement | Implementation |
|-------------|----------------|
| Reduced motion | Respect `prefers-reduced-motion` media query |
| Video alternatives | Static image fallbacks for micro-videos |
| No flashing | No content flashes more than 3 times/second |
| Clear language | Simple, jargon-free UI text |
| Error prevention | Confirmation for destructive actions |
| Error recovery | Clear error messages with solutions |

### Testing Strategy

**Responsive Testing:**

| Test Type | Tools/Methods |
|-----------|---------------|
| Browser DevTools | Chrome, Firefox, Safari responsive modes |
| Real devices | iPhone, Android phone, iPad, Android tablet |
| Cross-browser | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Network conditions | Throttled testing for mobile networks |

**Accessibility Testing:**

| Test Type | Tools/Methods |
|-----------|---------------|
| Automated scanning | axe DevTools, Lighthouse, WAVE |
| Keyboard testing | Manual tab-through of all flows |
| Screen reader | VoiceOver (Mac/iOS), NVDA (Windows) |
| Color blindness | Sim Daltonism, Chrome DevTools |
| Zoom testing | 200% browser zoom functionality |

**Testing Checklist:**

- [ ] All pages pass Lighthouse accessibility audit (90+ score)
- [ ] All pages pass axe DevTools with zero critical issues
- [ ] Complete user journeys work with keyboard only
- [ ] All content readable at 200% zoom
- [ ] Screen reader can navigate and complete quote flow
- [ ] Touch targets verified on actual mobile devices
- [ ] Reduced motion mode tested

### Implementation Guidelines

**Responsive Development:**

```css
/* Mobile-first media queries in Tailwind */
/* Default styles apply to mobile */
/* sm: 640px, md: 768px, lg: 1024px, xl: 1280px */

.component {
  /* Mobile default */
  @apply flex-col gap-4;

  /* Tablet and up */
  @apply md:flex-row md:gap-6;

  /* Desktop and up */
  @apply lg:gap-8;
}
```

**Accessibility Development:**

```tsx
// Semantic HTML structure
<main id="main-content">
  <article aria-labelledby="page-title">
    <h1 id="page-title">Page Title</h1>
    ...
  </article>
</main>

// Skip link
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Accessible button with icon
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// Form with error handling
<label htmlFor="email">Email</label>
<input
  id="email"
  aria-describedby="email-error"
  aria-invalid={hasError}
/>
{hasError && (
  <p id="email-error" role="alert">
    Please enter a valid email
  </p>
)}
```

**Motion Preference:**

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }

  .journey-stage video {
    display: none;
  }

  .journey-stage .fallback-image {
    display: block;
  }
}
```
