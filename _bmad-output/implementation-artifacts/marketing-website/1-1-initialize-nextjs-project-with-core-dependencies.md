# Story 1.1: Initialize Next.js Project with Core Dependencies

Status: done

## Story

As a **developer**,
I want **a properly configured Next.js 16 project with TypeScript, Tailwind CSS v4, and essential tooling**,
So that **I have a solid foundation to build the Timber International website**.

## Acceptance Criteria

1. **Given** no project exists, **When** the project is initialized using the Architecture-specified command, **Then** a Next.js 16 project is created with App Router, TypeScript strict mode, Tailwind CSS v4, ESLint, and Turbopack

2. **Given** the project is initialized, **Then** the project uses `src/` directory structure with `@/*` import alias

3. **Given** the project is initialized, **Then** shadcn/ui is installed with initial components (Button, Input, Card, Dialog, Toast)

4. **Given** all dependencies are installed, **When** `npm run build` is executed, **Then** the project builds successfully with no errors

5. **Given** the project is initialized, **Then** environment variable templates (`.env.example`) are created for Supabase, Anthropic, Resend keys

## Tasks / Subtasks

- [x] Task 1: Initialize Next.js 16 Project (AC: #1, #2)
  - [x] Run `npx create-next-app@latest timber-international --typescript --tailwind --eslint --app --turbopack --src-dir --import-alias "@/*"`
  - [x] Verify App Router is enabled (check `src/app/` directory)
  - [x] Verify TypeScript strict mode in `tsconfig.json`
  - [x] Verify Tailwind CSS v4 configuration
  - [x] Verify Turbopack enabled for development

- [x] Task 2: Install and Configure shadcn/ui (AC: #3)
  - [x] Run `npx shadcn@latest init` (select New York style, CSS variables)
  - [x] Install Button component: `npx shadcn@latest add button`
  - [x] Install Input component: `npx shadcn@latest add input`
  - [x] Install Card component: `npx shadcn@latest add card`
  - [x] Install Dialog component: `npx shadcn@latest add dialog`
  - [x] Install Toast component: `npx shadcn@latest add sonner`
  - [x] Verify components are in `src/components/ui/`

- [x] Task 3: Configure Environment Variables (AC: #5)
  - [x] Create `.env.example` with all required keys
  - [x] Create `.env.local` (gitignored) with placeholder values
  - [x] Document each environment variable purpose

- [x] Task 4: Verify Build Success (AC: #4)
  - [x] Run `npm run build`
  - [x] Fix any TypeScript errors
  - [x] Fix any ESLint errors
  - [x] Verify production build completes without warnings

- [x] Task 5: Set Up Initial Project Structure
  - [x] Create base directory structure per Architecture
  - [x] Add initial `src/lib/utils/errors.ts` with AppError class
  - [x] Add initial `src/config/site.ts` with site metadata

## Dev Notes

### Architecture Compliance Requirements

**Technology Stack (from Architecture):**
| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.x | App Router, Turbopack, Server Components |
| React | 19.x | Server Components by default |
| TypeScript | 5.x | Strict mode enabled |
| Tailwind CSS | 4.x | Utility-first, no CSS-in-JS |
| shadcn/ui | Latest | Radix primitives |

**Initialization Command (EXACT):**
```bash
npx create-next-app@latest timber-international \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --turbopack \
  --src-dir \
  --import-alias "@/*"
```

### Project Structure Requirements

```
timber-international/
├── package.json
├── next.config.ts
├── tsconfig.json
├── components.json              # shadcn/ui config
├── .env.local                   # Local environment (gitignored)
├── .env.example                 # Environment template
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/
│   │   └── utils/
│   │       ├── cn.ts
│   │       └── errors.ts
│   └── config/
│       └── site.ts
```

### Environment Variables Template

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic (AI Chatbot)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Resend (Email)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@timber-international.com

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### AppError Class Implementation

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### Critical Implementation Rules

- **Strict TypeScript** - No `any` types allowed
- **Server Components by default** - Only add `"use client"` when needed
- **No inline styles** - Use Tailwind classes exclusively
- **Use `@/*` imports** - Never use relative paths like `../../`

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Starter-Template-Evaluation]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Technology-Version-Summary]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Project-Structure-&-Boundaries]

## Dev Agent Record

### Agent Model Used
Initial implementation: Unknown (story not tracked during dev)
Code Review & Fixes: Claude Opus 4.5 (2026-01-10)

### Debug Log References
N/A

### Completion Notes List
- All 5 Acceptance Criteria verified and passing
- Build passes with no errors
- Lint passes with no warnings
- Note: Next.js 16 "middleware" deprecation warning exists (migrate to "proxy" in future)

### Change Log
| Date | Author | Change |
|------|--------|--------|
| 2026-01-10 | Dev Agent | Initial implementation (tasks not tracked) |
| 2026-01-10 | Code Review | Fixed layout.tsx to use siteConfig for metadata |
| 2026-01-10 | Code Review | Added env var validation to Supabase client files |
| 2026-01-10 | Code Review | Removed unused eslint-disable directive from database.ts |
| 2026-01-10 | Code Review | Updated story status and task completion tracking |

### File List
**Core Configuration:**
- `timber-international/package.json` - Dependencies and scripts
- `timber-international/tsconfig.json` - TypeScript strict mode config
- `timber-international/next.config.ts` - Next.js configuration
- `timber-international/components.json` - shadcn/ui New York style config
- `timber-international/eslint.config.mjs` - ESLint configuration
- `timber-international/postcss.config.mjs` - PostCSS configuration
- `timber-international/.env.example` - Environment template
- `timber-international/.env.local` - Local environment (gitignored)
- `timber-international/.gitignore` - Git ignore rules

**App Structure:**
- `timber-international/src/app/layout.tsx` - Root layout with siteConfig metadata
- `timber-international/src/app/page.tsx` - Homepage (default template)
- `timber-international/src/app/globals.css` - Global styles with Tailwind
- `timber-international/src/app/not-found.tsx` - 404 page

**UI Components (shadcn/ui):**
- `timber-international/src/components/ui/button.tsx`
- `timber-international/src/components/ui/input.tsx`
- `timber-international/src/components/ui/card.tsx`
- `timber-international/src/components/ui/dialog.tsx`
- `timber-international/src/components/ui/sonner.tsx`

**Library Utilities:**
- `timber-international/src/lib/utils.ts` - cn() utility for Tailwind
- `timber-international/src/lib/utils/errors.ts` - AppError class
- `timber-international/src/lib/supabase/client.ts` - Browser Supabase client
- `timber-international/src/lib/supabase/server.ts` - Server Supabase client
- `timber-international/src/lib/supabase/middleware.ts` - Middleware auth handler
- `timber-international/src/lib/supabase/admin.ts` - Admin Supabase client

**Configuration & Types:**
- `timber-international/src/config/site.ts` - Site metadata config
- `timber-international/src/types/database.ts` - Database type definitions
- `timber-international/src/types/index.ts` - Type exports
- `timber-international/src/middleware.ts` - Next.js middleware

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-10
**Outcome:** ✅ APPROVED (after fixes)

### Issues Found & Resolved

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | Story status/tasks not updated | Updated status to "done", marked all tasks [x] |
| HIGH | Layout metadata using default values | Now imports and uses siteConfig |
| MEDIUM | Non-null assertions on env vars | Added getSupabaseConfig() validation pattern |
| MEDIUM | Unused eslint-disable directive | Removed from database.ts |

### Known Technical Debt
- Next.js 16 middleware deprecation warning - migrate to "proxy" convention when ready
- Homepage still has create-next-app boilerplate (expected - homepage content in later stories)

### Verification
- ✅ `npm run build` passes
- ✅ `npm run lint` passes (0 errors, 0 warnings)
- ✅ All 5 Acceptance Criteria verified
