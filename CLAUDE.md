# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **BMad Method Framework** installation (v6.0.0-alpha.22) for the **Timber World Platform** project. BMad (Business Model Architecture Development) is an AI-assisted product development methodology with specialized agents and structured workflows.

### IMPORTANT: Architecture Shift (2026-01-20)

**Timber World has evolved from a single marketing website to a B2B Supply Chain Platform.**

The platform will include multiple apps serving different user types:
- **Marketing App** - Public-facing website (partially implemented)
- **Client Portal** - B2B customers (orders, tracking, reorder)
- **Producer Portal** - Factories (production tracking, efficiency, inventory)
- **Admin Portal(s)** - Internal staff (quotes, orders, analytics)
- **Supplier Portal** - Raw material suppliers (orders, invoices)

**Key Reference:** `_bmad-output/analysis/platform-vision-capture-2026-01-20.md`

### Current Status

| Component | Status |
|-----------|--------|
| Turborepo monorepo structure | ✅ Implemented |
| Shared packages (@timber/*) | ✅ Implemented |
| Marketing App (Epic 1-2) | ✅ Complete |
| Marketing App (Epic 3-8) | 📋 Backlog |
| Platform Product Brief | ❌ Not yet created |
| Platform PRD | ❌ Not yet created |
| Platform Architecture | ❌ Not yet created |
| Other Apps | ❌ Not yet created |

### Documentation Status

| Document | Scope | Notes |
|----------|-------|-------|
| `product-brief-*.md` | Marketing app only | Valid for marketing app |
| `prd.md` | Marketing app only | Valid for marketing app |
| `architecture.md` | Marketing app only | **Outdated** - code is now monorepo |
| `epic-*.yaml` | Marketing app only | Valid for marketing app |
| `platform-vision-capture-*.md` | Platform overview | **Start here** for platform planning |

## Directory Structure

```
├── apps/                     # Multiple frontend applications
│   └── marketing/            # Public marketing website (Next.js)
│   # Planned: client-portal/, producer-portal/, admin/, supplier-portal/
│
├── packages/                 # Shared code across all apps
│   ├── @timber/ui/           # Components + hooks
│   ├── @timber/auth/         # Authentication
│   ├── @timber/database/     # Supabase clients + types
│   ├── @timber/config/       # Configuration + i18n
│   └── @timber/utils/        # Utilities
│
├── supabase/                 # Database (serves ALL apps)
│
├── _bmad/                    # BMad Framework installation
│   ├── core/                 # Core framework (task engine, brainstorming)
│   ├── bmm/                  # BMad Method Module (main workflows & agents)
│   └── bmb/                  # BMad Builder Module (create custom agents/workflows)
│
├── _bmad-output/             # Generated artifacts
│   ├── analysis/             # Brainstorming + platform vision capture
│   ├── planning-artifacts/   # Product Brief, PRD (currently marketing-only)
│   └── implementation-artifacts/  # Epics, stories, sprint status
│
└── .claude/commands/bmad/    # Claude Code slash command integration
```

## Available Workflows (Slash Commands)

Workflows are invoked via slash commands. Key workflows by phase:

**Analysis:**
- `/bmad:bmm:workflows:research` - Market/Technical/Domain research
- `/bmad:bmm:workflows:create-product-brief` - Create Product Brief

**Planning:**
- `/bmad:bmm:workflows:create-prd` - Create PRD
- `/bmad:bmm:workflows:create-ux-design` - UX design planning

**Solutioning:**
- `/bmad:bmm:workflows:create-architecture` - Architecture decisions
- `/bmad:bmm:workflows:create-epics-and-stories` - Break down into stories
- `/bmad:bmm:workflows:check-implementation-readiness` - Validate readiness

**Implementation:**
- `/bmad:bmm:workflows:dev-story` - Execute a story
- `/bmad:bmm:workflows:code-review` - Adversarial code review
- `/bmad:bmm:workflows:sprint-planning` - Sprint management
- `/bmad:bmm:workflows:correct-course` - Handle changes during sprint

**Utilities:**
- `/bmad:bmm:workflows:workflow-status` - Check current status ("what should I do now?")
- `/bmad:bmm:workflows:quick-dev` - Flexible development without full ceremony
- `/bmad:core:workflows:brainstorming` - Creative ideation sessions
- `/bmad:core:workflows:party-mode` - Multi-agent discussions

## Available Agents

Agents are specialized AI personas with menus. Invoke via slash commands:

- `/bmad:bmm:agents:pm` - Product Manager (PRD, epics/stories)
- `/bmad:bmm:agents:analyst` - Business Analyst (product briefs, research)
- `/bmad:bmm:agents:architect` - Solution Architect (architecture decisions)
- `/bmad:bmm:agents:dev` - Developer (implementation)
- `/bmad:bmm:agents:ux-designer` - UX Designer
- `/bmad:bmm:agents:tea` - Test Engineer/Architect
- `/bmad:bmm:agents:sm` - Scrum Master (sprint management)
- `/bmad:bmm:agents:tech-writer` - Technical Writer
- `/bmad:bmm:agents:quick-flow-solo-dev` - Solo dev mode

## Key Architecture Concepts

### Workflow Execution
Workflows follow a step-file architecture defined in YAML/markdown. The core task engine (`_bmad/core/tasks/workflow.xml`) processes workflows by:
1. Loading workflow configuration from YAML
2. Resolving variables from `_bmad/bmm/config.yaml`
3. Executing steps in order with user checkpoints
4. Writing output to template files

### Agent Activation
Agents load their persona from markdown files with embedded XML configuration. Each agent has:
- A persona (role, communication style, principles)
- A menu of available actions/workflows
- Handlers that route menu selections to workflows

### Output Artifacts
All generated documents go to `_bmad-output/` following the pattern:
- Planning artifacts: `_bmad-output/planning-artifacts/`
- Implementation artifacts: `_bmad-output/implementation-artifacts/`

## Configuration

Project configuration in `_bmad/bmm/config.yaml`:
- `user_name`: Nils
- `project_name`: Timber World
- `communication_language`: English
- `output_folder`: `{project-root}/_bmad-output`

## Database (Supabase Cloud)

This project uses **Supabase cloud only** - no local Docker database is used.

**Key commands:**
- `npx supabase db push` - Apply migrations to the remote cloud database
- `npx supabase db diff` - Generate migration from remote schema changes

**Never use:**
- `npx supabase db reset` - Requires Docker (not available in this project)
- `npx supabase start` - Requires Docker for local development

The `supabase/config.toml` file is required for the Supabase CLI to work with migrations, but it does not mean a local database is used. All database operations are performed against the cloud Supabase instance.

## Component Standards

### DataEntryTable (Inventory / Production / Product Tables)

All editable tables related to **inventory, production, and product data** must use the `DataEntryTable` generic component from `@timber/ui`. This includes package entry, stock management, production tracking, and any table where users input or edit product-related records.

**Location:** `packages/ui/src/components/data-entry-table.tsx`

**Import:** `import { DataEntryTable, type ColumnDef } from "@timber/ui";`

**Built-in features:**
- Column types: `readonly`, `dropdown` (collapsible), `text`, `custom` (via `renderCell`)
- Sort & filter per column (via `ColumnHeaderMenu` popover)
- Keyboard navigation: Enter (next field), Arrow keys (horizontal at edges, vertical)
- Add / Copy / Delete rows with automatic renumbering
- Totals footer (count, sum, custom formatTotal)
- Collapse/expand for dropdown columns with localStorage persistence

**Usage pattern:** Create a thin wrapper component (e.g., `PackageEntryTable`) that defines `ColumnDef<TRow>[]` and domain-specific callbacks (`onCellChange`, `copyRow`, `renumberRows`, `createRow`).

**Not required for:** Other tables in the system (e.g., admin listings, analytics dashboards, user management) may use different table patterns as appropriate.

## Working with BMad

1. **Check status**: Use `/bmad:bmm:workflows:workflow-status` to see where the project is
2. **Follow the phases**: Analysis → Planning → Solutioning → Implementation
3. **Use agents for guided work**: Agents provide menus and structure
4. **Use workflows for specific tasks**: Workflows execute predefined processes
5. **Artifacts build on each other**: PRD requires Product Brief, Architecture requires PRD, etc.
