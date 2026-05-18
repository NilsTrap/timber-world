# Timber World Platform

A B2B supply chain platform for the timber industry, built as a monorepo with multiple applications.

## Applications

| App | Description | URL |
|-----|-------------|-----|
| **Marketing** | Public website for Timber International | [timber-international.com](https://timber-international.com) |
| **Portal** | B2B portal for producers, clients, and admin | (internal) |

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack in dev)
- **Language:** TypeScript (strict, no `any`)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL) — **cloud only, no local Docker**
- **Authentication:** Supabase Auth
- **Deployment:** Vercel
- **Monorepo:** Turborepo + pnpm workspaces

## Project Structure

```
├── apps/
│   ├── marketing/          # Public marketing website
│   └── portal/             # B2B portal application
├── packages/
│   ├── @timber/ui/         # Shared UI components
│   ├── @timber/auth/       # Authentication utilities
│   ├── @timber/database/   # Supabase clients & types
│   ├── @timber/config/     # Configuration & i18n
│   └── @timber/utils/      # Shared utilities
└── supabase/               # Database migrations
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Environment Variables

Copy the example env files and fill in your values:

```bash
cp apps/marketing/.env.example apps/marketing/.env.local
cp apps/portal/.env.example apps/portal/.env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - (Portal) For privileged server actions (admin operations, data fixes). Never expose to the browser.
- `RESEND_API_KEY` - (Marketing only) For quote form emails

### Development

```bash
# Run all apps
pnpm dev

# Run specific app (use the @timber/<name> workspace name)
pnpm dev --filter=@timber/marketing   # port 3000
pnpm dev --filter=@timber/portal      # port 3001
```

### Build

```bash
pnpm build
```

### Database migrations

The Supabase database is **cloud only** — there is no local Docker DB. Apply migrations with:

```bash
npx supabase db push     # apply migrations to the cloud DB
npx supabase db diff     # generate a migration from remote schema changes
```

Do **not** use `npx supabase db reset` or `npx supabase start` — both require Docker.

## Deployment

### Marketing Website

Deployed to Vercel with:
- **Domain:** timber-international.com
- **Root Directory:** `apps/marketing`
- **Build Command:** `pnpm build`

### Portal

Deployed to Vercel separately with:
- **Root Directory:** `apps/portal`

## Documentation

For working in this codebase, the primary references are:

- **[`CLAUDE.md`](./CLAUDE.md)** — codebase guide for AI agents and humans: directory structure, permissions model, component standards (DataEntryTable / ColumnHeaderMenu / page layouts), navigation state persistence patterns, domain conventions (Manufacturer/Workshop naming, production date semantics, in-place output update invariants).
- **[`_bmad-output/project-context.md`](./_bmad-output/project-context.md)** — implementation rules and patterns for AI code generators (tech stack versions, permission checks, ActionResult shape, data transformation, file organisation, naming, i18n, etc.).
- **[`_bmad-output/implementation-artifacts/platform/sprint-status.yaml`](./_bmad-output/implementation-artifacts/platform/sprint-status.yaml)** — running log of completed epics with one-line summaries of what changed and why.
- **[`_bmad-output/planning-artifacts/`](./_bmad-output/planning-artifacts/)** — Product briefs, PRDs, architecture decisions.
- **[`_bmad-output/implementation-artifacts/`](./_bmad-output/implementation-artifacts/)** — Epic and story breakdowns.
