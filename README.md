# Timber World Platform

A B2B supply chain platform for the timber industry, built as a monorepo with multiple applications.

## Applications

| App | Description | URL |
|-----|-------------|-----|
| **Marketing** | Public website for Timber International | [timber-international.com](https://timber-international.com) |
| **Portal** | B2B portal for producers, clients, and admin | (internal) |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
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
- `RESEND_API_KEY` - (Marketing only) For quote form emails

### Development

```bash
# Run all apps
pnpm dev

# Run specific app
pnpm dev --filter=marketing
pnpm dev --filter=portal
```

### Build

```bash
pnpm build
```

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

See `_bmad-output/` for detailed planning and implementation artifacts:
- `planning-artifacts/` - Product briefs, PRDs, architecture
- `implementation-artifacts/` - Epic and story breakdowns
