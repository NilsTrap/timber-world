---
project_name: 'Timber-International'
user_name: 'Nils'
date: '2026-01-10'
status: 'complete'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'critical_rules']
---

# Project Context for AI Agents

_Critical rules and patterns for implementing code in this project. Focus on unobvious details that agents might miss._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.x | App Router, Turbopack, Server Components |
| React | 19.x | Server Components by default |
| TypeScript | 5.x | Strict mode enabled |
| Tailwind CSS | 4.x | Utility-first, no CSS-in-JS |
| Supabase | Latest | PostgreSQL + Auth + RLS |
| Vercel AI SDK | 6.x | Anthropic provider |
| shadcn/ui | Latest | Radix primitives |
| React Hook Form | Latest | With Zod validation |
| Zod | Latest | Schema validation |
| next-intl | Latest | 8 languages |
| Resend | Latest | Transactional email |

## Critical Implementation Rules

### TypeScript Rules

- **Strict mode is ON** - No `any` types allowed
- Use `type` for data shapes, `interface` for extendable contracts
- All function parameters and returns must be typed
- Use Zod schemas for runtime validation, not just TS types

### React/Next.js Rules

- **Server Components by default** - Only add `"use client"` when needed (hooks, events, browser APIs)
- **Never use `fetch` in Client Components** - Use Server Actions or API routes
- **URL state for filters** - Use `useSearchParams` for catalog filter state, not useState
- **No inline styles** - Use Tailwind classes exclusively
- Server Actions must return `{ success: true, data } | { success: false, error }`

### Supabase Rules

- **Use correct client for context:**
  - `lib/supabase/client.ts` - Browser/Client Components
  - `lib/supabase/server.ts` - Server Components/Actions
  - `lib/supabase/admin.ts` - Admin operations (service role)
- **Always enable RLS** - No tables without Row Level Security
- **Use snake_case** for all database identifiers

### i18n Rules (next-intl)

- All user-facing strings must use `useTranslations()`
- Translation keys use dot notation: `"products.filter.wood_type"`
- Never hardcode text in components - even "Loading..."
- Default locale is `en`, supported: en, fi, sv, no, da, nl, de, es

### API Response Format

```typescript
// Success: { data: T } or { data: T[], meta: { total, page, pageSize } }
// Error: { error: { message: string, code: string } }
// Codes: VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INTERNAL_ERROR
```

### Testing Rules

- Co-locate unit tests: `ComponentName.test.tsx`
- E2E tests in `tests/e2e/`
- Mock Supabase client in tests, never hit real database
- Test Server Actions with mock FormData

### Code Quality Rules

- Components: PascalCase files (`ProductCard.tsx`)
- Hooks/utils: camelCase files (`useProducts.ts`)
- Database tables: snake_case plural (`quote_requests`)
- API routes: kebab-case (`/api/quote-requests`)
- Constants: UPPER_SNAKE_CASE

### Critical Don't-Miss Rules

**NEVER:**
- Import from `@supabase/supabase-js` directly - use lib clients
- Use `console.log` in production - use structured logging
- Store API keys in code - use environment variables
- Skip Zod validation on form inputs
- Use `any` or `// @ts-ignore`
- Add `"use client"` to pages - only to specific components

**ALWAYS:**
- Handle loading states with Skeleton components
- Handle errors with toast notifications (sonner)
- Use `next/image` for all images
- Add proper aria-labels for accessibility
- Include error boundaries around feature components
