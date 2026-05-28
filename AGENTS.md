<!-- BEGIN:nextjs-agent-rules -->
# WARNING: This is Next.js 16 — Not the version in your training data

APIs, conventions, and file structure differ from Next.js 13/14. Before writing any Next.js code:
- Read node_modules/next/dist/docs/ for current API references
- Heed all deprecation notices
- Do not assume routing, layout, or data-fetching patterns from older versions
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md

## Project rule

Agents may assist with implementation, review, documentation, and testing, but the repository remains the source of truth.

## Before changing files

1. Read CLAUDE.md for project-specific rules and domain glossary.
2. Read README.md.
3. Inspect existing project structure.
4. Confirm the task has clear acceptance criteria.

## Change discipline

- Make minimal changes. Keep commits logically grouped.
- Do not create new architecture without approval.
- Do not overwrite existing work unless explicitly instructed.
- Do not touch secrets or .env files.
- Every database query MUST be scoped to tenantId — no exceptions.

## Required final report

Every agent task should end with: Summary, Files changed, Verification performed, Risks, Recommended next step.
