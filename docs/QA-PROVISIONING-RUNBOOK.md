# Isolated QA Provisioning Runbook

This is the owner handoff for #289, #298, and #295. It creates a disposable QA boundary for browser mutation tests and reset rehearsals. It does **not** authorize work against the current shared integration stack or production.

## 1. Create a LastPass folder

Create `Metis / QA Development`. Store only revocable QA credentials there. Keep production credentials in the existing restricted folder. Do not put values in Git, chat, issue comments, screenshots, or shared `.env` files.

## 2. Provision distinct QA identities

Create resources that are not aliases, branches, buckets, or keys of production:

- Neon: a QA database/branch with a host distinct from production.
- Clerk: a QA development instance with its own publishable key, secret key, and backend instance ID.
- Cloudflare R2: a QA-only bucket with a unique name and limited key.
- Stripe: test-mode key and webhook endpoint only.
- Resend: sink/allowlist mode; no customer-recipient delivery.
- AI and any paid provider: separate, revocable QA key or keep disabled.

Create a tagged QA fixture organization and owner only after the isolated Clerk instance exists. Do not reuse a live tenant/user.

## 3. Configure each development machine

On WSL and macOS separately, clone the repository, run `npm run bootstrap`, then create the ignored `.env.local` from QA values in LastPass. Set:

```text
APP_ENV=integration
METIS_ENVIRONMENT_ID=metis-qa
INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID=metis-qa
INTEGRATION_ALLOWED_DATABASE_HOSTS=<QA Neon host>
INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS=<QA Clerk host>
INTEGRATION_ALLOWED_CLERK_INSTANCE_IDS=<QA Clerk backend instance ID>
INTEGRATION_ALLOWED_R2_BUCKET_NAMES=<QA bucket>
INTEGRATION_EMAIL_MODE=sink
INTEGRATION_CRON_MODE=disabled
INTEGRATION_AUCTION_MODE=disabled
INTEGRATION_AI_MODE=disabled
```

Populate the associated QA `DATABASE_URL`, Clerk, R2, Stripe test, and Resend sink values. Keep the production allowlists populated with production identities so the guard can reject them.

## 4. Configure hosted QA separately

If a hosted QA deployment is needed, use a dedicated QA Vercel environment/project and the same QA identities. Preview/integration values must not point at production. Do not enable cron, auction, AI, or email side effects merely to make a test pass.

## 5. Verify before any mutation

Run the non-mutating checks from a machine with its own QA `.env.local`:

```bash
npm run env:check
npm run context:check
npx tsx scripts/integration-reset-preflight.ts --confirm metis-qa
```

The last command must report that it changed no state. If it refuses, correct the QA configuration; do not weaken an allowlist or point it at shared integration/production.

## 6. Request the authorized rehearsal

After preflight passes, provide its output and the QA environment ID. The next authorized work is the guarded fixture/full-reset rehearsal, followed by browser mutation evidence (trace, screenshots, request ID, audit event, database assertion, cleanup).

## Recovery

For a lost machine or VPS, revoke that machine's QA credentials in the provider dashboards/LastPass and recreate its ignored `.env.local`. GitHub remains the canonical code and non-secret context store.
