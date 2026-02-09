---
stepsCompleted: [1, 2, 3, 4]
workflowStatus: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/marketing-website/prd.md'
  - '_bmad-output/planning-artifacts/marketing-website/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Timber-International - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Timber-International, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Homepage & Emotional Experience (FR1-FR5):**
- FR1: Visitors can view a full-screen forest hero image/video upon landing on the website
- FR2: Visitors can read a powerful slogan that communicates the brand positioning
- FR3: Visitors can scroll through the production journey visual story (forest → logs → sawmill → kilns → elements → panels → CNC → finishing)
- FR4: Visitors can see call-to-action buttons at the end of the production journey scroll
- FR5: Visitors can access persistent navigation menu from any point on the homepage

**Product Catalog (FR6-FR16):**
- FR6: Visitors can browse the complete product catalog without logging in
- FR7: Visitors can filter products by species (oak, etc.)
- FR8: Visitors can filter products by dimensions (width, length, thickness)
- FR9: Visitors can filter products by quality grade
- FR10: Visitors can filter products by type (FJ - finger jointed, FS - full stave)
- FR11: Visitors can filter products by moisture content
- FR12: Visitors can filter products by finish type
- FR13: Visitors can filter products by FSC certification status
- FR14: Visitors can view stock pricing displayed per m³, per piece, and per m²
- FR15: Visitors can see current stock availability status for products
- FR16: Visitors can select multiple products to include in a quote request

**Quotation System (FR17-FR26):**
- FR17: Visitors can submit quote requests via a structured form
- FR18: Visitors can interact with an AI chatbot to request quotes conversationally
- FR19: AI chatbot can guide visitors through required quote information (~10 fields)
- FR20: AI chatbot can answer common questions about products and processes
- FR21: Visitors can specify delivery location for transport cost calculation
- FR22: Visitors can request quotes for stock products (standard path)
- FR23: Visitors can request quotes for production orders (custom path)
- FR24: Visitors requesting custom products can specify dimensions, finishes, and CNC requirements
- FR25: System can distinguish between standard quotes (auto-calculable) and custom quotes (manual processing)
- FR26: Visitors receive confirmation after submitting a quote request

**Industry Resources & Information (FR27-FR31):**
- FR27: Visitors can access industry resources page with educational content
- FR28: Visitors can learn about wood species characteristics
- FR29: Visitors can learn about quality standards and grading
- FR30: Visitors can access contact information and company details
- FR31: Visitors can see regions/countries served by Timber International

**Multi-Language Support (FR32-FR35):**
- FR32: Visitors can view the website in English (base language)
- FR33: Visitors can switch to Finnish, Swedish, Norwegian, Danish, Dutch, German, or Spanish
- FR34: System can auto-translate content to the 8 supported languages
- FR35: Visitors can select their preferred language via navigation

**Admin: Content Management (FR36-FR41):**
- FR36: Content Manager can upload inventory data files to update product database
- FR37: System can validate uploaded inventory data and flag anomalies
- FR38: Content Manager can review and confirm data updates before publishing
- FR39: Content Manager can upload pricing data files
- FR40: Content Manager can make manual corrections to product data
- FR41: System displays updated inventory/pricing on the public catalog after confirmation

**Admin: Analytics & Monitoring (FR42-FR48):**
- FR42: Analytics Admin can view total website visitor counts
- FR43: Analytics Admin can view visitor breakdown by country/region
- FR44: Analytics Admin can view time spent on production journey page
- FR45: Analytics Admin can view product catalog engagement metrics
- FR46: Analytics Admin can view quote request submission counts
- FR47: Analytics Admin can view quote completion funnel (started vs. submitted)
- FR48: Analytics Admin can compare metrics across time periods

**Internal: Quote Management (FR49-FR56):**
- FR49: Quote Handler can view queue of incoming quote requests
- FR50: Quote Handler can see all details submitted in each quote request
- FR51: Quote Handler can generate quotes for standard product requests
- FR52: Quote Handler can coordinate with production for custom quote requests
- FR53: Quote Handler can send quote responses to customers
- FR54: Quote Handler can send acknowledgment messages for complex requests
- FR55: Quote Handler can track quote response status (pending, sent, followed-up)
- FR56: Quote Handler can send follow-up messages on unanswered quotes

### NonFunctional Requirements

**Performance:**
- NFR1: First Contentful Paint < 1.5 seconds
- NFR2: Largest Contentful Paint < 2.5 seconds
- NFR3: Time to Interactive < 3.5 seconds
- NFR4: Cumulative Layout Shift < 0.1
- NFR5: Filter application in catalog < 500ms
- NFR6: Quote form submission < 2 seconds
- NFR7: Page navigation < 1.5 seconds
- NFR8: Language switch < 2 seconds
- NFR9: Production journey images use lazy loading
- NFR10: Catalog product images use WebP format with fallbacks
- NFR11: CDN delivery for static assets

**Security:**
- NFR12: All data transmitted over HTTPS (TLS 1.2+)
- NFR13: Quote request data stored securely
- NFR14: Admin panel requires authentication
- NFR15: Admin actions logged for audit trail
- NFR16: Session timeout after period of inactivity
- NFR17: Standard rate limiting on catalog access
- NFR18: Cookie consent mechanism for EU visitors (GDPR)
- NFR19: Privacy policy accessible
- NFR20: Ability to delete customer data upon request (GDPR)

**Scalability:**
- NFR21: System handles 100 concurrent visitors without degradation
- NFR22: Static content cached aggressively
- NFR23: Database queries optimized for catalog filtering
- NFR24: Architecture supports 5x traffic growth without major redesign

**Accessibility:**
- NFR25: WCAG 2.1 Level A compliance (minimum), targeting Level AA
- NFR26: Minimum 4.5:1 color contrast ratio for text
- NFR27: All interactive elements accessible via keyboard (Tab/Enter)
- NFR28: Alt text on all meaningful images including production journey
- NFR29: All form fields properly labeled with error messages
- NFR30: Visible focus states for keyboard users
- NFR31: Proper heading hierarchy (H1-H6), landmark regions
- NFR32: Skip links to allow keyboard users to skip to main content
- NFR33: Touch targets minimum 44x44px
- NFR34: Respect `prefers-reduced-motion` for scroll animations

**Reliability:**
- NFR35: 99.5% monthly uptime (~3.6 hours maximum downtime per month)
- NFR36: Automated uptime monitoring with alerts
- NFR37: Error tracking for critical paths (quote submission, catalog)
- NFR38: Daily database backups, weekly full system backups
- NFR39: Recovery point objective < 24 hours
- NFR40: Recovery time objective < 4 hours
- NFR41: If AI chatbot unavailable, quote form remains functional
- NFR42: If translation service unavailable, English content displays
- NFR43: Static content served from cache during backend issues

**Integration:**
- NFR44: Auto-translation API integration for multi-language content
- NFR45: Analytics platform integration for visitor tracking
- NFR46: Email service integration for quote confirmations
- NFR47: AI/LLM service integration for chatbot functionality
- NFR48: All external API calls include timeout handling (max 10 seconds)
- NFR49: Fallback behavior defined for each integration failure
- NFR50: API credentials stored securely (not in code)
- NFR51: Inventory/pricing file upload supports CSV format
- NFR52: Validation before import with clear error messages
- NFR53: Rollback capability if import fails

### Additional Requirements

**From Architecture - Starter Template:**
- Initialize project using Next.js 16 (App Router) with TypeScript, Tailwind CSS v4, ESLint, Turbopack, src directory, and @/* import alias
- Command: `npx create-next-app@latest timber-international --typescript --tailwind --eslint --app --turbopack --src-dir --import-alias "@/*"`

**From Architecture - Technology Stack:**
- Database: Supabase (PostgreSQL) with Row Level Security
- Authentication: Supabase Auth (email/password for admin)
- UI Components: shadcn/ui (Tailwind-based, accessible)
- AI Chatbot: Vercel AI SDK + Anthropic (Claude)
- Email: Resend for notifications
- Analytics: Vercel Analytics
- Forms: React Hook Form + Zod validation
- Internationalization: next-intl with pre-translated JSON files
- Hosting: Vercel with Git integration for CI/CD

**From Architecture - Data Models:**
- `products` table: Catalog items with pricing, stock, specifications
- `quote_requests` table: Customer quote submissions
- `admin_users` table: Internal users with Supabase Auth

**From Architecture - Implementation Patterns:**
- Tables use snake_case plural naming (e.g., `products`, `quote_requests`)
- API routes use kebab-case (e.g., `/api/quote-requests`)
- Components use PascalCase (e.g., `ProductCard.tsx`)
- Server Actions return `{ success: true, data }` or `{ success: false, error }` shape
- Use Server Components by default, Client Components only when needed
- Custom `AppError` class for structured error handling
- Toast notifications via sonner for user feedback

**From Architecture - Project Structure:**
- App Router with route groups: `(public)` and `admin`
- Locale wrapper: `[locale]/` for i18n
- Component organization: `ui/`, `layout/`, `features/`, `shared/`
- Library organization: `lib/supabase/`, `lib/ai/`, `lib/email/`, `lib/actions/`, `lib/validations/`, `lib/utils/`

**From UX Design - Production Journey:**
- 8-stage visual storytelling: Forest → Sawmill → Kilns → Elements/Panels → CNC → Finishing → Quality Control → Delivery
- Each stage: full-screen micro-video or high-res image with gradient overlay
- Scroll-triggered content reveals (Apple-style)
- Horizontal galleries within certain stages (swipe navigation)
- Progress indicator (dots or stage counter)

**From UX Design - Chatbot Experience:**
- Dual input modes: voice (speech-to-text) and text
- Chatbot responds with voice + text
- Auto-fills form fields from conversation
- Progress bar showing quote completion percentage
- Handles both quote requests and general questions

**From UX Design - Visual Design:**
- Color palette: Forest Green (#1B4332), Warm Oak (#8B5A2B), Warm Cream (#FAF6F1), Charcoal (#2D3436)
- Typography: Playfair Display for headlines, Inter for body
- Generous whitespace (premium feel)
- Transparent navigation over hero, solid on other pages
- Full-bleed imagery with text overlay

**From UX Design - Response Time Commitments:**
- Dynamic confirmation messages based on submission time
- Standard quote, weekday before 4pm: "We'll respond by this evening"
- Friday after 4pm or weekend: "We'll respond by Monday evening"
- Complex/custom quote: "We'll respond within 24 hours"

**From UX Design - Responsive Design:**
- Desktop-first approach
- Tablet-optimized for sales agent demos
- Mobile responsive for quick access
- Catalog: sidebar filters on desktop, drawer on mobile
- ProductTable becomes card-based list on mobile

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Full-screen forest hero image/video |
| FR2 | Epic 2 | Powerful brand positioning slogan |
| FR3 | Epic 2 | Production journey scroll (8 stages) |
| FR4 | Epic 2 | CTAs at end of production journey |
| FR5 | Epic 2 | Persistent navigation menu |
| FR6 | Epic 3 | Browse catalog without login |
| FR7 | Epic 3 | Filter by species |
| FR8 | Epic 3 | Filter by dimensions |
| FR9 | Epic 3 | Filter by quality grade |
| FR10 | Epic 3 | Filter by type (FJ/FS) |
| FR11 | Epic 3 | Filter by moisture content |
| FR12 | Epic 3 | Filter by finish type |
| FR13 | Epic 3 | Filter by FSC certification |
| FR14 | Epic 3 | Stock pricing display (m³/piece/m²) |
| FR15 | Epic 3 | Stock availability status |
| FR16 | Epic 3 | Select multiple products for quote |
| FR17 | Epic 4 | Submit quotes via structured form |
| FR18 | Epic 4 | AI chatbot for conversational quotes |
| FR19 | Epic 4 | Chatbot guides through ~10 fields |
| FR20 | Epic 4 | Chatbot answers common questions |
| FR21 | Epic 4 | Specify delivery location |
| FR22 | Epic 4 | Request stock product quotes |
| FR23 | Epic 4 | Request production order quotes |
| FR24 | Epic 4 | Specify custom dimensions/finishes/CNC |
| FR25 | Epic 4 | Distinguish standard vs custom quotes |
| FR26 | Epic 4 | Confirmation after submission |
| FR27 | Epic 5 | Industry resources page |
| FR28 | Epic 5 | Wood species characteristics |
| FR29 | Epic 5 | Quality standards and grading |
| FR30 | Epic 5 | Contact information and details |
| FR31 | Epic 5 | Regions/countries served |
| FR32 | Epic 5 | Website in English (base) |
| FR33 | Epic 5 | Switch to 7 other languages |
| FR34 | Epic 5 | Auto-translate to 8 languages |
| FR35 | Epic 5 | Language selector in navigation |
| FR36 | Epic 6 | Upload inventory data files |
| FR37 | Epic 6 | Validate and flag anomalies |
| FR38 | Epic 6 | Review/confirm before publishing |
| FR39 | Epic 6 | Upload pricing data files |
| FR40 | Epic 6 | Manual corrections to product data |
| FR41 | Epic 6 | Updated data on public catalog |
| FR42 | Epic 7 | View visitor counts |
| FR43 | Epic 7 | Visitor breakdown by country |
| FR44 | Epic 7 | Time on production journey page |
| FR45 | Epic 7 | Catalog engagement metrics |
| FR46 | Epic 7 | Quote submission counts |
| FR47 | Epic 7 | Quote completion funnel |
| FR48 | Epic 7 | Compare metrics across time |
| FR49 | Epic 8 | View quote request queue |
| FR50 | Epic 8 | See all quote details |
| FR51 | Epic 8 | Generate quotes for standard requests |
| FR52 | Epic 8 | Coordinate for custom requests |
| FR53 | Epic 8 | Send quote responses |
| FR54 | Epic 8 | Send acknowledgment messages |
| FR55 | Epic 8 | Track quote response status |
| FR56 | Epic 8 | Send follow-up messages |

## Epic List

### Epic 1: Project Foundation & Core Infrastructure

**Goal:** Establish the development foundation with all core infrastructure, enabling the team to build features on a solid, configured project base.

Initialize the Next.js 16 project with TypeScript, Tailwind CSS v4, and shadcn/ui. Set up Supabase database with schema for products, quotes, and admin users. Configure admin authentication, core layout components (Header, Footer, Navigation), and i18n infrastructure with next-intl.

**FRs covered:** Foundation (enables all FRs)
**NFRs addressed:** NFR12 (HTTPS), NFR14 (admin auth), NFR25-34 (accessibility foundation)

---

### Epic 2: Immersive Homepage & Production Journey

**Goal:** Visitors experience the emotional "Production Orchestrator" story that builds trust and creates desire to work with Timber International.

Implement full-screen forest hero with micro-video and powerful slogan. Build the 8-stage production journey with scroll-triggered animations, gradient overlays, and stage-specific content (Forest → Sawmill → Kilns → Elements/Panels → CNC → Finishing → Quality Control → Delivery). Add CTAs at journey end and implement navigation behavior (transparent over hero, solid elsewhere).

**FRs covered:** FR1, FR2, FR3, FR4, FR5
**NFRs addressed:** NFR1-4 (performance), NFR9 (lazy loading), NFR28 (image alt text), NFR34 (reduced motion)

---

### Epic 3: Product Catalog & Discovery

**Goal:** Visitors can browse, filter, and discover products with transparent stock pricing and availability information.

Build the product catalog page with sidebar filters (species, dimensions, quality grade, type, moisture, finish, FSC certification). Implement ProductTable/ProductCard components with pricing display (per m³, per piece, per m²), stock availability status, and multi-select for quote requests. Create responsive layout with drawer filters on mobile.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16
**NFRs addressed:** NFR5 (filter speed), NFR10 (WebP images), NFR17 (rate limiting), NFR23 (query optimization)

---

### Epic 4: Quote Request System

**Goal:** Visitors can submit quote requests for stock or custom products via structured form or AI chatbot and receive confirmation with specific response timelines.

Build the quote request form with dual path (stock vs production/custom). Implement AI chatbot with Vercel AI SDK + Anthropic for conversational quotes and Q&A. Add delivery location field, custom specs (dimensions, finishes, CNC), file upload for project drawings. Create confirmation page with dynamic response time commitments. Integrate Resend for email notifications.

**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26
**NFRs addressed:** NFR6 (submission speed), NFR13 (secure storage), NFR41 (chatbot fallback), NFR46-47 (email integration)

---

### Epic 5: Content Pages & Multi-Language Support

**Goal:** International visitors can access educational resources and contact information in their preferred language (8 languages).

Build Industry Resources pages with wood species characteristics and quality standards content. Create Contact page with company details and regions served. Implement full i18n with next-intl for 8 languages (English, Finnish, Swedish, Norwegian, Danish, Dutch, German, Spanish). Add language switcher to navigation. Set up translation JSON files and hreflang tags for SEO.

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35
**NFRs addressed:** NFR8 (language switch speed), NFR42 (English fallback), NFR44 (translation API)

---

### Epic 6: Admin Content Management

**Goal:** Content Manager (Katri) can keep product inventory and pricing accurate through validated file uploads.

Build admin product management pages with CSV upload functionality. Implement data validation with anomaly detection and error flagging. Create review/confirm workflow before publishing updates. Add manual correction capability for individual products. Display update status and sync confirmation.

**FRs covered:** FR36, FR37, FR38, FR39, FR40, FR41
**NFRs addressed:** NFR14-16 (admin auth/logging/timeout), NFR51-53 (CSV import/validation/rollback)

---

### Epic 7: Admin Analytics Dashboard

**Goal:** Analytics Admin (Johan) can monitor website performance and business metrics to guide marketing and operational decisions.

Integrate Vercel Analytics for visitor tracking. Build analytics dashboard with visitor counts, geographic breakdown, and time-on-page metrics. Add production journey engagement tracking. Implement quote funnel visualization (started vs submitted). Create time period comparison functionality.

**FRs covered:** FR42, FR43, FR44, FR45, FR46, FR47, FR48
**NFRs addressed:** NFR36-37 (monitoring/error tracking), NFR45 (analytics integration)

---

### Epic 8: Internal Quote Management

**Goal:** Quote Handler (Lisa) can efficiently process incoming quotes, send responses, and track follow-ups to maximize conversion.

Build admin quote queue with filtering and sorting. Create quote detail view with all submission data. Implement quote response sending with templates. Add acknowledgment message capability for complex requests. Build status tracking (pending/sent/followed-up) and follow-up reminder system.

**FRs covered:** FR49, FR50, FR51, FR52, FR53, FR54, FR55, FR56
**NFRs addressed:** NFR15 (audit logging), NFR46 (email service)

---

## Epic 1: Project Foundation & Core Infrastructure

**Goal:** Establish the development foundation with all core infrastructure, enabling the team to build features on a solid, configured project base.

### Story 1.1: Initialize Next.js Project with Core Dependencies

As a **developer**,
I want **a properly configured Next.js 16 project with TypeScript, Tailwind CSS v4, and essential tooling**,
So that **I have a solid foundation to build the Timber International website**.

**Acceptance Criteria:**

**Given** no project exists
**When** the project is initialized using the Architecture-specified command
**Then** a Next.js 16 project is created with App Router, TypeScript strict mode, Tailwind CSS v4, ESLint, and Turbopack
**And** the project uses src/ directory structure with @/* import alias
**And** shadcn/ui is installed with initial components (Button, Input, Card, Dialog, Toast)
**And** the project builds successfully with `npm run build`
**And** environment variable templates (.env.example) are created for Supabase, Anthropic, Resend keys

---

### Story 1.2: Configure Supabase Database and Initial Schema

As a **developer**,
I want **Supabase connected with the core database schema**,
So that **the application can store products, quotes, and admin users**.

**Acceptance Criteria:**

**Given** a configured Next.js project
**When** Supabase is integrated
**Then** Supabase client libraries are installed (@supabase/supabase-js, @supabase/ssr)
**And** client, server, and admin Supabase clients are created in lib/supabase/
**And** the `products` table is created with columns: id, sku, species, width, length, thickness, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status, created_at, updated_at
**And** the `quote_requests` table is created with columns: id, type (stock/custom), status, contact_name, contact_email, contact_phone, company_name, delivery_location, products (jsonb), custom_specs (jsonb), created_at, updated_at
**And** the `admin_users` table is created (linked to Supabase Auth)
**And** Row Level Security policies are configured for each table
**And** TypeScript types are generated from the database schema

---

### Story 1.3: Implement Admin Authentication

As an **admin user**,
I want **to securely log in to the admin panel**,
So that **I can access content management and quote handling features**.

**Acceptance Criteria:**

**Given** a configured Supabase project with admin_users table
**When** an admin visits /admin
**Then** they are redirected to /admin/login if not authenticated
**And** the login page displays email/password form with validation
**And** successful login redirects to /admin dashboard
**And** failed login shows appropriate error message
**And** authenticated sessions persist across page refreshes
**And** session timeout occurs after 24 hours of inactivity
**And** logout functionality clears session and redirects to login
**And** Next.js middleware protects all /admin/* routes

---

### Story 1.4: Create Core Layout Components

As a **visitor**,
I want **consistent navigation and footer across all pages**,
So that **I can easily navigate the website and access key actions**.

**Acceptance Criteria:**

**Given** the base project structure
**When** layout components are implemented
**Then** Header component displays logo (links to home), navigation menu (Products, Resources, Contact), language switcher placeholder, and "Request Quote" CTA button
**And** Header has two visual states: transparent (over hero) and solid (cream background)
**And** Footer component displays company info, navigation links, and copyright
**And** Navigation is keyboard accessible with visible focus states
**And** Mobile navigation uses hamburger menu with full-screen overlay
**And** Root layout wraps all pages with Header and Footer
**And** Skip link is implemented for keyboard users ("Skip to main content")
**And** All components use the defined color palette (Forest Green, Warm Cream, Charcoal)

---

### Story 1.5: Set Up Internationalization Infrastructure

As a **developer**,
I want **i18n infrastructure configured with next-intl**,
So that **the website can support 8 languages with proper routing and SEO**.

**Acceptance Criteria:**

**Given** the Next.js project with layout components
**When** next-intl is configured
**Then** the [locale] dynamic route segment is implemented
**And** middleware detects browser language and redirects appropriately
**And** English (en) translation file is created with initial keys for navigation, common UI, and meta tags
**And** Placeholder files are created for fi, sv, no, da, nl, de, es locales
**And** LanguageSwitcher component displays current language and dropdown to switch
**And** hreflang meta tags are generated for all supported locales
**And** URL structure follows /[locale]/page pattern (e.g., /en/products, /de/products)
**And** Default locale (en) works without locale prefix (optional: /products redirects to /en/products)

---

## Epic 2: Immersive Homepage & Production Journey

**Goal:** Visitors experience the emotional "Production Orchestrator" story that builds trust and creates desire to work with Timber International.

### Story 2.1: Build Homepage Hero Section

As a **visitor**,
I want **to see a stunning full-screen forest hero with a powerful slogan when I land on the homepage**,
So that **I immediately feel the emotional impact and understand Timber International's connection to nature**.

**Acceptance Criteria:**

**Given** a visitor navigates to the homepage
**When** the page loads
**Then** a full-screen (100vh) hero section displays with forest micro-video background (or high-res image fallback)
**And** the brand slogan is displayed prominently using Playfair Display typography
**And** a subtle gradient overlay ensures text readability
**And** a scroll indicator (arrow or "Scroll to explore") appears at the bottom
**And** the video loops seamlessly (2-4 seconds, no audio)
**And** if `prefers-reduced-motion` is set, a static image displays instead of video
**And** the hero image/video loads within LCP target (<2.5s)
**And** navigation appears transparent with white text over the hero

---

### Story 2.2: Create Production Journey Scroll Container

As a **visitor**,
I want **to scroll through a seamless production journey experience**,
So that **I can follow the story from forest to finished product**.

**Acceptance Criteria:**

**Given** the hero section is visible
**When** the visitor scrolls down
**Then** the page transitions smoothly into the production journey section
**And** the journey contains 8 distinct stages displayed as full-screen (100vh) sections
~~**And** a progress indicator shows current position (e.g., "3 of 8" or dot navigation)~~ **[REMOVED 2026-01-17]** - Removed for cleaner visual design
**And** scroll behavior is smooth with appropriate easing
**And** the navigation fades out during downward scroll for immersion
**And** scrolling up brings the navigation back
**And** keyboard users can navigate stages with arrow keys
**And** touch devices support natural swipe gestures

---

### Story 2.3: Implement JourneyStage Component

As a **developer**,
I want **a reusable JourneyStage component for each production stage**,
So that **all 8 stages render consistently with the defined visual treatment**.

**Acceptance Criteria:**

**Given** the journey scroll container exists
**When** a JourneyStage component is rendered
**Then** it displays a full-screen background (micro-video or image)
**And** a gradient overlay (bottom 30-40%) ensures text readability
**And** the stage headline displays in Playfair Display (large, white/cream)
**And** the expertise subtext displays in Inter below the headline
**And** content fades in with scroll-triggered animation (unless reduced motion)
**And** images use lazy loading and WebP format with fallbacks
**And** alt text is provided for all images (accessibility)
**And** the component accepts props: stageNumber, videoSrc, imageFallback, headline, subtext

---

### Story 2.4: Populate 8 Production Journey Stages

As a **visitor**,
I want **to experience each stage of the production journey with unique visuals and messaging**,
So that **I understand how Timber International controls quality from forest to delivery**.

**Acceptance Criteria:**

**Given** the JourneyStage component exists
**When** the homepage renders
**Then** 8 stages are displayed in order:
1. **Forest** - Sustainability, stewardship message
2. **Sawmill** - Skilled craftsmanship message
3. **Kilns** - Patience, mastery, slow drying message
4. **Elements/Panels** - Human touch, manual selection message
5. **CNC** - Craft meets technology message
6. **Finishing** - Sustainable finishes message
7. **Quality Control** - Accountability, zero compromise message
8. **Delivery** - Trust, reliability message
**And** each stage has placeholder images/videos (to be replaced with real content)
**And** each stage has headline and subtext content (English, translatable)
**And** translation keys are added to the i18n messages files
**And** the journey feels cohesive with consistent pacing between stages

---

### Story 2.5: Add Journey Completion CTAs

As a **visitor**,
I want **clear calls-to-action at the end of the production journey**,
So that **I can take the next step toward working with Timber International**.

**Acceptance Criteria:**

**Given** the visitor has scrolled through all 8 journey stages
**When** they reach the end of the journey
**Then** a CTA section displays with two prominent buttons: "View Products" and "Request Quote"
**And** buttons use the primary (Forest Green) and secondary button styles
**And** "View Products" links to /[locale]/products
**And** "Request Quote" links to /[locale]/quote
**And** the section maintains the visual aesthetic (background image/color, proper spacing)
**And** a subtle animation draws attention to the CTAs
**And** buttons are keyboard accessible and have visible focus states

---

## Epic 3: Product Catalog & Discovery

**Goal:** Visitors can browse, filter, and discover products with transparent stock pricing and availability information.

### Story 3.1: Create Product Catalog Page Layout

As a **visitor**,
I want **to access a well-organized product catalog page**,
So that **I can browse Timber International's product offerings**.

**Acceptance Criteria:**

**Given** a visitor navigates to /[locale]/products
**When** the page loads
**Then** a catalog page displays with sidebar filter panel (280px, left) and results area (right)
**And** the page header shows "Product Catalog" title and product count
**And** the results area displays products in a responsive grid (3-4 columns on desktop)
**And** the page loads without requiring login (FR6)
**And** SEO meta tags are set for the catalog page
**And** the page follows the solid header navigation style
**And** loading states show skeleton components while data fetches

---

### Story 3.2: Implement ProductFilter Component

As a **visitor**,
I want **to filter products by multiple criteria**,
So that **I can quickly find products matching my specifications**.

**Acceptance Criteria:**

**Given** the catalog page is displayed
**When** filter options are rendered
**Then** the following filter groups are available as collapsible sections with checkboxes:
- Species (oak, etc.) - FR7
- Width (mm ranges) - FR8
- Length (mm ranges) - FR8
- Thickness (mm options) - FR8
- Quality grade - FR9
- Type (FJ - finger jointed, FS - full stave) - FR10
- Moisture content (%) - FR11
- Finish type - FR12
- FSC certification (yes/no) - FR13
**And** each filter group shows active filter count badge
**And** a "Clear all filters" button resets all selections
**And** filter state is reflected in URL query parameters (shareable)
**And** filter changes apply within 500ms (NFR5)
**And** all filter controls are keyboard accessible

---

### Story 3.3: Build Products API and Data Fetching ✅ IMPLEMENTED

As a **developer**,
I want **an API endpoint for fetching filtered products**,
So that **the catalog can display products based on user selections**.

**Implementation Notes (2026-02-09):**
- Implemented as Server Action in `apps/marketing/src/lib/actions/products.ts`
- Data sourced from `inventory_packages` table (real stock data from INERCE/MAS organizations)
- Extended `StockProduct` type includes display fields for dimension ranges
- Supports filtering by species, type, and text search
- Supports sorting by all columns with default alphabetical order
- Price columns (unit_price_piece, unit_price_m3, unit_price_m2) added to inventory_packages
- MAS prices imported from products table via migration

**Acceptance Criteria:**

**Given** the products table exists with sample data
**When** GET /api/products is called
**Then** it returns products matching the provided filter query parameters
**And** the response includes: id, sku, species, dimensions, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status
**And** pagination is supported via `page` and `pageSize` parameters
**And** sorting is supported via `sortBy` and `sortOrder` parameters
**And** the response follows the standard API format: `{ data: Product[], meta: { total, page, pageSize } }`
**And** database queries are optimized with appropriate indexes (NFR23)
**And** rate limiting is applied to prevent abuse (NFR17)
**And** seed data includes at least 20 sample products for testing

---

### Story 3.4: Implement ProductTable with Pricing Display ✅ IMPLEMENTED

As a **visitor**,
I want **to see products displayed with clear pricing and availability information**,
So that **I can compare options and make informed decisions**.

**Implementation Notes (2026-02-09):**
- Implemented in `apps/marketing/src/components/features/catalog/ProductTable.tsx`
- Columns: Product, Thickness, Width, Length, Pieces, m³, €/m³, €/Piece, €/m²
- Numeric columns right-aligned for proper number comparison
- Dimension ranges displayed (e.g., "100-350") using display fields
- European number formatting with comma decimal separator
- "On Request" displayed when prices are not available
- "-" displayed for missing piece counts
- Default alphabetical sorting by product name

**Acceptance Criteria:**

**Given** products are loaded from the API
**When** the ProductTable component renders
**Then** products display in a table with columns: Product/SKU, Dimensions, Quality, Stock Status, €/m³, €/piece, €/m²
**And** stock pricing is clearly visible without login (FR14)
**And** stock availability shows status indicator (In Stock, Low Stock, Out of Stock) (FR15)
**And** columns are sortable by clicking headers
**And** current sort column shows ascending/descending indicator
**And** empty state shows friendly message when no products match filters
**And** prices are formatted with € symbol and appropriate decimals
**And** table rows have hover state for visual feedback

---

### Story 3.5: Add Product Selection for Quote

As a **visitor**,
I want **to select multiple products to include in a quote request**,
So that **I can request pricing for everything I need in one submission**.

**Acceptance Criteria:**

**Given** products are displayed in the catalog
**When** a visitor selects products
**Then** each product row has a checkbox for selection (FR16)
**And** a floating selection summary bar appears when products are selected
**And** the summary shows: "{N} products selected" and "Request Quote" button
**And** clicking "Request Quote" navigates to /[locale]/quote with selected product IDs
**And** selected products are passed via URL parameters or session storage
**And** "Select all visible" and "Clear selection" options are available
**And** selection persists when applying filters (within session)

---

### Story 3.6: Implement Responsive Catalog Layout

As a **visitor on mobile or tablet**,
I want **the catalog to work well on smaller screens**,
So that **I can browse products from any device**.

**Acceptance Criteria:**

**Given** a visitor accesses the catalog on a mobile device
**When** the page renders
**Then** the sidebar filters collapse into a slide-out drawer (triggered by "Filters" button)
**And** the filter drawer has a close button and "Apply Filters" action
**And** products display as cards in a single column instead of table rows
**And** each product card shows: image thumbnail, product name, dimensions, price (primary), stock status
**And** product selection works via card tap/checkbox
**And** the floating selection bar is positioned for mobile usability
**And** touch targets meet 44x44px minimum (NFR33)
**And** tablet view (768px-1023px) uses 2-column card grid with collapsible sidebar

---

## Epic 4: Quote Request System

**Goal:** Visitors can submit quote requests for stock or custom products via structured form or AI chatbot and receive confirmation with specific response timelines.

### Story 4.1: Create Quote Request Page Layout ✅ PARTIALLY IMPLEMENTED

As a **visitor**,
I want **to access a quote request page with clear options**,
So that **I can choose how to request a quote**.

**Implementation Notes (2026-02-09):**
- Implemented in `apps/marketing/src/app/[locale]/quote/page.tsx`
- Two-column layout: Quote form (left), Contact info card (right)
- Contact info displays company address (Latvia), email, phone
- Footer hidden on quote page via ConditionalFooter component
- SEO metadata with proper hreflang tags
- i18n support for all 8 languages
- **Not yet implemented:** Chat mode, product selection from catalog

**Acceptance Criteria:**

**Given** a visitor navigates to /[locale]/quote
**When** the page loads
**Then** a quote page displays with two input modes: Form and Chat
**And** tabs or toggle allow switching between modes
**And** if products were selected from catalog, they display in a "Selected Products" section
**And** the page uses centered layout (max-width 800px) for focused experience
**And** SEO meta tags are set appropriately
**And** the page follows solid header navigation style

---

### Story 4.2: Build Quote Request Form ✅ IMPLEMENTED

As a **visitor**,
I want **to submit a quote request via a structured form**,
So that **I can provide my requirements in a clear format** (FR17).

**Implementation Notes (2026-02-09):**
- Implemented in `apps/marketing/src/components/features/quote/QuoteForm.tsx`
- Contact section: Name*, Company, Email*, Phone
- Product specs: Product (full width), Species/Type/Quality/Humidity (row), Thickness/Width/Length/Pieces (row)
- Additional notes textarea with preselected products support
- Form submission via Server Action sends email to info@timber-international.com
- Success state shows thank you message
- Error handling with user-friendly error display
- Full i18n support across all 8 languages

**Acceptance Criteria:**

**Given** the form tab is active on the quote page
**When** the form renders
**Then** required fields include: contact name, email, phone, company name
**And** product specification fields include: selected products (from catalog or manual entry), quantities
**And** delivery location field with country/region selection (FR21)
**And** optional fields include: project description, timeline, special requirements
**And** form validation uses Zod schemas with inline error messages
**And** all fields have proper labels and accessibility attributes
**And** form state persists if user switches tabs (not lost)

---

### Story 4.3: Implement Dual Quote Path (Stock vs Custom)

As a **visitor**,
I want **to specify whether I need stock products or custom production**,
So that **my quote is routed correctly** (FR22, FR23, FR25).

**Acceptance Criteria:**

**Given** the quote form is displayed
**When** quote type selection is rendered
**Then** two clear options are available: "Stock Products" and "Custom/Production Order"
**And** Stock path shows: product selection, quantity, delivery location
**And** Custom path adds: custom dimensions fields, finish selection, CNC requirements textarea, file upload for drawings (FR24)
**And** the system tags the quote as "standard" or "custom" based on selection (FR25)
**And** custom quotes display note: "Custom quotes require manual review"
**And** file upload accepts common formats (PDF, DWG, images) with size limit

---

### Story 4.4: Integrate AI Chatbot for Conversational Quotes

As a **visitor**,
I want **to request a quote through a conversational chat interface**,
So that **I can describe my needs naturally** (FR18, FR19, FR20).

**Acceptance Criteria:**

**Given** the chat tab is active on the quote page
**When** the chatbot interface renders
**Then** a welcome message introduces the quote assistant
**And** the chatbot uses Vercel AI SDK with Anthropic Claude
**And** the chatbot guides users through required information (~10 fields) (FR19)
**And** the chatbot can answer common questions about products, pricing, and processes (FR20)
**And** collected information auto-populates the quote form fields
**And** a progress indicator shows completion percentage
**And** users can switch to form view to review/edit collected data
**And** if chatbot is unavailable, graceful fallback to form-only mode (NFR41)
**And** chat history is maintained within the session

---

### Story 4.5: Submit Quote and Send Notifications ✅ PARTIALLY IMPLEMENTED

As a **visitor**,
I want **my quote request to be submitted and confirmed**,
So that **I know Timber International received my request** (FR26).

**Implementation Notes (2026-02-09):**
- Implemented in `apps/marketing/src/lib/actions/quote.ts`
- Uses Resend API for email delivery (requires RESEND_API_KEY env var)
- Sends formatted HTML and plain text email to info@timber-international.com
- Email includes all form fields with proper formatting
- In-form success message displayed on submission
- **Not yet implemented:** Database storage, visitor confirmation email, reference number

**Acceptance Criteria:**

**Given** a completed quote form (via form or chatbot)
**When** the visitor submits the quote
**Then** the quote is saved to the quote_requests table in Supabase
**And** submission completes within 2 seconds (NFR6)
**And** an email confirmation is sent to the visitor via Resend
**And** an internal notification email is sent to the quote handling team
**And** the quote is assigned a unique reference number
**And** the visitor is redirected to the confirmation page
**And** if submission fails, a clear error message is shown with retry option

---

### Story 4.6: Display Quote Confirmation with Response Timeline

As a **visitor**,
I want **to see confirmation with a specific response timeline**,
So that **I know when to expect a reply**.

**Acceptance Criteria:**

**Given** a quote has been successfully submitted
**When** the confirmation page displays
**Then** a success message confirms receipt with quote reference number
**And** response timeline is calculated dynamically:
- Standard quote, weekday before 4pm: "We'll respond by this evening"
- Weekday after 4pm: "We'll respond by tomorrow evening"
- Friday after 4pm / weekend: "We'll respond by Monday evening"
- Custom/complex quote: "We'll respond within 24 hours"
**And** "What happens next" section explains the process
**And** links to return to homepage or browse products are provided
**And** the confirmation is translatable (i18n keys)

---

## Epic 5: Content Pages & Multi-Language Support

**Goal:** International visitors can access educational resources and contact information in their preferred language (8 languages).

### Story 5.1: Create Industry Resources Page

As a **visitor**,
I want **to access educational content about wood products**,
So that **I can make informed purchasing decisions** (FR27).

**Acceptance Criteria:**

**Given** a visitor navigates to /[locale]/resources
**When** the page loads
**Then** an Industry Resources page displays with organized educational content
**And** the page has a clear heading and introduction
**And** content is organized into logical sections (species, quality, processes)
**And** internal links connect to relevant product catalog filters
**And** SEO meta tags optimize for industry search terms
**And** the page is fully translatable via i18n keys
**And** the page follows the solid header navigation style

---

### Story 5.2: Build Wood Species and Quality Content

As a **visitor**,
I want **to learn about wood species characteristics and quality standards**,
So that **I understand what I'm purchasing** (FR28, FR29).

**Acceptance Criteria:**

**Given** the resources page exists
**When** species and quality sections are rendered
**Then** wood species section covers oak characteristics, properties, and applications (FR28)
**And** quality standards section explains grading criteria and what each grade means (FR29)
**And** content includes visual aids (images, comparison tables)
**And** technical specifications are presented clearly
**And** content links to relevant products in the catalog
**And** all content text is stored in i18n translation files

---

### Story 5.3: Create Contact Page

As a **visitor**,
I want **to find contact information and see regions served**,
So that **I can reach Timber International or verify they serve my area** (FR30, FR31).

**Acceptance Criteria:**

**Given** a visitor navigates to /[locale]/contact
**When** the page loads
**Then** company contact details are displayed: address, phone, email (FR30)
**And** a map or visual shows regions/countries served (FR31)
**And** a list of served countries is provided (Nordic, European markets)
**And** a simple contact form is available for general inquiries
**And** the "Request Quote" CTA is prominently displayed
**And** business hours or response expectations are shown
**And** all content is translatable via i18n keys

---

### Story 5.4: Complete Translation Files for All Languages

As an **international visitor**,
I want **the website content available in my language**,
So that **I can understand everything without translation tools** (FR32, FR33, FR34).

**Acceptance Criteria:**

**Given** the i18n infrastructure exists with English base
**When** translation files are completed
**Then** all 8 language files are populated: en, fi, sv, no, da, nl, de, es
**And** translation keys cover: navigation, homepage, journey stages, catalog, quote form, resources, contact, common UI elements, error messages
**And** English (en) serves as the complete base language (FR32)
**And** other languages can be initially populated with English content for later translation
**And** a translation workflow is documented for updating content
**And** date, number, and currency formats respect locale conventions

---

### Story 5.5: Implement Language Switcher Functionality

As a **visitor**,
I want **to easily switch the website language**,
So that **I can view content in my preferred language** (FR33, FR35).

**Acceptance Criteria:**

**Given** the website is displayed in any language
**When** a visitor clicks the language switcher
**Then** a dropdown shows all 8 available languages with native names (FR35)
**And** selecting a language redirects to the same page in the new locale
**And** the language preference is stored (cookie or localStorage)
**And** language switch completes within 2 seconds (NFR8)
**And** if a translation is missing, English content displays as fallback (NFR42)
**And** the current language is visually indicated in the switcher
**And** hreflang meta tags are updated for SEO

---

## Epic 6: Admin Content Management

**Goal:** Content Manager (Katri) can keep product inventory and pricing accurate through validated file uploads.

### Story 6.1: Create Admin Dashboard and Navigation

As a **Content Manager**,
I want **an admin dashboard with clear navigation**,
So that **I can easily access content management features**.

**Acceptance Criteria:**

**Given** an authenticated admin user
**When** they access /admin
**Then** a dashboard displays with overview metrics (product count, pending quotes, recent uploads)
**And** sidebar navigation shows: Dashboard, Products, Quotes, Analytics
**And** the admin layout is distinct from the public site (different header/styling)
**And** the current user's name and logout option are visible
**And** breadcrumb navigation shows current location
**And** the dashboard is responsive for tablet use

---

### Story 6.2: Build CSV Upload for Inventory and Pricing

As a **Content Manager**,
I want **to upload CSV files to update product inventory and pricing**,
So that **the catalog stays current with minimal effort** (FR36, FR39).

**Acceptance Criteria:**

**Given** an admin navigates to /admin/products/upload
**When** the upload page loads
**Then** a file upload zone accepts CSV files (drag-drop or click to browse)
**And** upload type selection: "Inventory Update" or "Pricing Update"
**And** a sample CSV template is downloadable for reference
**And** file size limit is enforced (e.g., 10MB max)
**And** upload progress indicator shows during processing
**And** the system parses CSV and displays preview of changes
**And** upload history shows recent uploads with status

---

### Story 6.3: Implement Data Validation and Anomaly Detection

As a **Content Manager**,
I want **uploaded data to be validated with anomalies flagged**,
So that **I can catch errors before they affect the public catalog** (FR37).

**Acceptance Criteria:**

**Given** a CSV file has been uploaded
**When** validation runs
**Then** the system checks for: required fields present, valid data types, reasonable value ranges
**And** anomalies are flagged: unusually low/high prices, unexpected stock changes, missing SKUs
**And** validation results display in a clear summary: valid rows, warnings, errors
**And** each flagged item shows the issue and affected row
**And** the admin can review each anomaly and approve or reject
**And** critical errors block import until resolved
**And** warnings allow import with acknowledgment

---

### Story 6.4: Create Review and Confirm Workflow

As a **Content Manager**,
I want **to review and confirm updates before they go live**,
So that **I maintain control over what appears on the public site** (FR38).

**Acceptance Criteria:**

**Given** uploaded data has passed validation
**When** the review screen displays
**Then** a summary shows: products to add, products to update, products unchanged
**And** detailed diff view shows before/after for updated products
**And** "Confirm Update" button applies changes to the database
**And** "Cancel" button discards the upload without changes
**And** confirmation requires explicit action (not auto-apply)
**And** successful update shows confirmation with count of affected products
**And** the public catalog reflects updates immediately after confirmation (FR41)
**And** an audit log entry records the update action

---

### Story 6.5: Enable Manual Product Corrections

As a **Content Manager**,
I want **to manually edit individual product records**,
So that **I can make quick corrections without a full CSV upload** (FR40).

**Acceptance Criteria:**

**Given** an admin navigates to /admin/products
**When** the product list displays
**Then** products are shown in a searchable, sortable table
**And** clicking a product opens an edit form with all fields
**And** editable fields include: pricing, stock quantity, stock status, specifications
**And** form validation matches CSV validation rules
**And** "Save" applies changes immediately to the database
**And** changes reflect on the public catalog (FR41)
**And** edit history is logged for audit purposes
**And** "Cancel" discards changes and returns to list

---

## Epic 7: Admin Analytics Dashboard

**Goal:** Analytics Admin (Johan) can monitor website performance and business metrics to guide marketing and operational decisions.

### Story 7.1: Integrate Vercel Analytics

As a **developer**,
I want **Vercel Analytics integrated into the application**,
So that **visitor data is collected for the analytics dashboard**.

**Acceptance Criteria:**

**Given** the Next.js application is deployed on Vercel
**When** Vercel Analytics is configured
**Then** @vercel/analytics package is installed and initialized in the root layout
**And** page views are automatically tracked across all routes
**And** Web Vitals (LCP, FCP, CLS, TTI) are collected
**And** geographic data is captured based on visitor location
**And** analytics data is accessible via Vercel Analytics API
**And** no personally identifiable information is collected (GDPR compliant)

---

### Story 7.2: Build Analytics Dashboard Page

As an **Analytics Admin**,
I want **a dashboard showing key website metrics**,
So that **I can monitor performance at a glance** (FR42).

**Acceptance Criteria:**

**Given** an authenticated admin navigates to /admin/analytics
**When** the dashboard loads
**Then** key metrics display in card format: total visitors, page views, quote submissions
**And** a date range selector allows filtering (today, 7 days, 30 days, custom)
**And** metrics update based on selected date range
**And** loading states show while data fetches
**And** the dashboard layout is clean and scannable
**And** data refreshes on page load (no real-time requirement)

---

### Story 7.3: Display Visitor and Geographic Metrics

As an **Analytics Admin**,
I want **to see visitor counts broken down by country**,
So that **I can understand our geographic reach** (FR42, FR43).

**Acceptance Criteria:**

**Given** the analytics dashboard is displayed
**When** visitor metrics are rendered
**Then** total unique visitors count is displayed prominently (FR42)
**And** a geographic breakdown shows visitors by country/region (FR43)
**And** data displays as a table or chart (top 10 countries)
**And** percentage of total is shown for each country
**And** the breakdown respects the selected date range
**And** unknown/unresolved locations are grouped as "Other"

---

### Story 7.4: Show Engagement and Conversion Metrics

As an **Analytics Admin**,
I want **to see how visitors engage with key pages**,
So that **I can optimize the user experience** (FR44, FR45, FR46, FR47).

**Acceptance Criteria:**

**Given** the analytics dashboard is displayed
**When** engagement metrics are rendered
**Then** production journey metrics show: average time on page, scroll completion rate (FR44)
**And** catalog engagement shows: page views, filter usage, products viewed (FR45)
**And** quote metrics show: total submissions, submissions by type (stock/custom) (FR46)
**And** quote funnel shows: started vs submitted, with conversion rate (FR47)
**And** each metric includes trend indicator (up/down vs previous period)
**And** clicking a metric shows more detailed breakdown

---

### Story 7.5: Enable Time Period Comparison

As an **Analytics Admin**,
I want **to compare metrics across different time periods**,
So that **I can identify trends and measure campaign impact** (FR48).

**Acceptance Criteria:**

**Given** the analytics dashboard is displayed
**When** comparison mode is enabled
**Then** a "Compare to" option allows selecting a previous period
**And** comparison options include: previous period, same period last month, custom range
**And** metrics display current value and comparison value side-by-side
**And** percentage change is calculated and displayed (e.g., +15%, -8%)
**And** positive changes show green, negative show red (contextually appropriate)
**And** charts can overlay current and comparison periods

---

## Epic 8: Internal Quote Management

**Goal:** Quote Handler (Lisa) can efficiently process incoming quotes, send responses, and track follow-ups to maximize conversion.

### Story 8.1: Build Quote Request Queue

As a **Quote Handler**,
I want **to see a queue of incoming quote requests**,
So that **I can prioritize and process them efficiently** (FR49).

**Acceptance Criteria:**

**Given** an authenticated admin navigates to /admin/quotes
**When** the queue page loads
**Then** quote requests display in a sortable table
**And** columns include: reference number, date, company, type (stock/custom), status
**And** filtering options: by status (pending, responded, followed-up), by type, by date range
**And** sorting options: newest first, oldest first, by company
**And** pending quotes are highlighted for attention
**And** count badges show quotes by status
**And** clicking a row opens the quote detail view

---

### Story 8.2: Create Quote Detail View

As a **Quote Handler**,
I want **to see all details of a quote request**,
So that **I can prepare an accurate response** (FR50).

**Acceptance Criteria:**

**Given** a quote is selected from the queue
**When** the detail view opens
**Then** all submitted information displays: contact details, company, delivery location
**And** for stock quotes: selected products with quantities are listed
**And** for custom quotes: specifications, dimensions, CNC requirements, uploaded files are shown (FR52)
**And** uploaded files can be downloaded/viewed
**And** quote history shows all status changes and communications
**And** action buttons are available: Respond, Acknowledge, Mark as Followed Up
**And** a notes field allows internal comments

---

### Story 8.3: Implement Quote Response Sending

As a **Quote Handler**,
I want **to send quote responses to customers**,
So that **they receive pricing for their requests** (FR51, FR53).

**Acceptance Criteria:**

**Given** a quote detail is open
**When** "Send Response" is clicked
**Then** a response form opens with customer email pre-filled
**And** for standard quotes: pricing can be auto-calculated from catalog (FR51)
**And** for custom quotes: manual pricing entry is required
**And** response template includes: greeting, pricing table, validity period, next steps
**And** the response can be previewed before sending
**And** "Send" dispatches email via Resend and updates quote status
**And** sent response is logged in quote history
**And** status changes to "Responded"

---

### Story 8.4: Add Acknowledgment Messages

As a **Quote Handler**,
I want **to send acknowledgment messages for complex requests**,
So that **customers know we're working on their quote** (FR54).

**Acceptance Criteria:**

**Given** a complex/custom quote needs more time
**When** "Send Acknowledgment" is clicked
**Then** an acknowledgment template opens
**And** the message confirms receipt and provides estimated response time
**And** the handler can customize the message
**And** "Send" dispatches email and logs in quote history
**And** quote status updates to "Acknowledged" or remains "In Progress"
**And** the acknowledgment is distinguishable from a full response in history

---

### Story 8.5: Implement Status Tracking and Follow-ups

As a **Quote Handler**,
I want **to track quote status and send follow-ups**,
So that **I can maximize conversion of unanswered quotes** (FR55, FR56).

**Acceptance Criteria:**

**Given** quotes exist in various statuses
**When** the queue is viewed
**Then** status options include: Pending, Acknowledged, Responded, Followed Up, Converted, Closed (FR55)
**And** status can be manually updated from the detail view
**And** quotes without response after X days are flagged for follow-up
**And** "Send Follow-up" action opens a follow-up email template (FR56)
**And** follow-up message can be customized before sending
**And** follow-up is logged in quote history
**And** dashboard shows quotes needing follow-up

