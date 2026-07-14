import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const appEnv = process.env.APP_ENV
const environmentId = process.env.METIS_ENVIRONMENT_ID
const databaseUrl = process.env.DATABASE_URL
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const errors: string[] = []
if (!appEnv || !environmentId) errors.push('APP_ENV and METIS_ENVIRONMENT_ID are required.')
if (appEnv === 'production') errors.push('Local development must not use APP_ENV=production.')
if (!databaseUrl) errors.push('DATABASE_URL is required to run database-backed commands.')
if (!clerkKey) errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required to run authenticated flows.')
if (appEnv === 'integration' && !process.env.INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID) {
  errors.push('Integration requires INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID for reset preflight.')
}

if (errors.length > 0) {
  for (const error of errors) console.error(`environment check: ${error}`)
  process.exit(1)
}

console.log(`environment check passed: ${appEnv} (${environmentId})`)
