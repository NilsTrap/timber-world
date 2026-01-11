# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **BMad Method Framework** installation (v6.0.0-alpha.22) for the **Timber International** website project. BMad (Business Model Architecture Development) is an AI-assisted product development methodology with specialized agents and structured workflows.

**Current project status:** Planning phase - Product Brief completed, progressing toward PRD and Architecture.

## Directory Structure

```
├── _bmad/                    # BMad Framework installation
│   ├── core/                 # Core framework (task engine, brainstorming)
│   ├── bmm/                  # BMad Method Module (main workflows & agents)
│   └── bmb/                  # BMad Builder Module (create custom agents/workflows)
├── _bmad-output/             # Generated artifacts (planning docs, implementation docs)
│   ├── analysis/             # Brainstorming sessions
│   ├── planning-artifacts/   # Product Brief, PRD, requirements
│   └── implementation-artifacts/
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
- `project_name`: Timber-International
- `communication_language`: English
- `output_folder`: `{project-root}/_bmad-output`

## Working with BMad

1. **Check status**: Use `/bmad:bmm:workflows:workflow-status` to see where the project is
2. **Follow the phases**: Analysis → Planning → Solutioning → Implementation
3. **Use agents for guided work**: Agents provide menus and structure
4. **Use workflows for specific tasks**: Workflows execute predefined processes
5. **Artifacts build on each other**: PRD requires Product Brief, Architecture requires PRD, etc.
