# Architecture

## Recommended starting architecture

Use a straightforward web application architecture that can run locally and deploy cleanly to cloud hosting.

Suggested baseline:

- Frontend: Next.js or similar React framework
- Backend/API: Next.js API routes, FastAPI, or Node/Express depending on existing code
- Database: PostgreSQL
- Local database: Docker container
- ORM: Prisma, Drizzle, SQLAlchemy, or equivalent
- Auth: Clerk, Auth.js, Supabase Auth, or Azure Entra External ID depending on target market
- Deployment: Vercel, Azure App Service, Render, Fly.io, or a VPS later if needed

## Repository structure

Recommended structure:

```text
repo-root/
  app/ or src/
  docs/
  tasks/
  prompts/
  scripts/
  tests/
  .github/
  AGENTS.md
  README.md
  .env.example
```

## Non-negotiables

- Keep secrets out of source control.
- Use environment variables for credentials.
- Require a repeatable local setup.
- Add tests before allowing agents to perform large refactors.
- Keep all agent changes behind branches and PRs.

## Future agent layer

Once the application has tests, CI, and stable deployment, add agent orchestration for:

- Issue triage
- PR drafting
- Automated documentation updates
- Regression testing
- Support ticket classification
- Deployment notes
