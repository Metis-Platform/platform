# platform
AI-assisted operational platform for real estate, analytics, automation, and workflow management.

# Metis Platform (REI SaaS App) — Project Handoff Package

This package is intended to restart the REI SaaS App with a clean delivery structure.

## Recommended operating model

Use a conventional repository and issue/PR workflow as the system of record. Use coding agents to execute scoped work, not to replace source control, planning, testing, or deployment discipline.

Recommended stack:

- Primary IDE: Cursor or VS Code
- Main coding agent: Claude Code
- Secondary coding/review agent: OpenAI Codex
- Source control: GitHub
- Work management: GitHub Issues + GitHub Projects
- Local runtime: personal workstation first
- Cloud runtime: VPS only for staging/demo/deployment, not day-to-day development

## Package contents

- `docs/PROJECT_STATUS.md` — current state and working assumptions
- `docs/PRODUCT_PLAN.md` — product direction and functional scope
- `docs/ARCHITECTURE.md` — target architecture and repo layout
- `docs/LOCAL_SETUP.md` — recommended local workstation setup
- `docs/VPS_SETUP.md` — when and how to use an Ubuntu VPS
- `docs/AGENT_WORKFLOW.md` — how to use Claude Code, Codex, Cursor, and VS Code without losing control
- `docs/SECURITY.md` — key handling, secrets, and operational boundaries
- `docs/DECISIONS.md` — architecture decision record starter
- `tasks/BACKLOG.md` — initial backlog
- `prompts/AGENT_SYSTEM_PROMPT.md` — reusable project instructions for AI coding agents
- `.github/copilot-instructions.md` — GitHub Copilot/Codex project instructions
- `AGENTS.md` — agent-facing repo instructions
- `.env.example` — environment variable template
- `.gitignore` — baseline ignores

## Immediate next step

Create or update the actual app repo, copy these files into the repo root, then use `tasks/BACKLOG.md` to create GitHub Issues.
