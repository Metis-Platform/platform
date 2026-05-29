import { config } from 'dotenv'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/app/generated/prisma'

// Load .env.local in non-production environments (covers seed scripts and local dev).
// In production (Vercel), DATABASE_URL is injected directly as an env var.
// dotenv.config() is a no-op when the file doesn't exist, so this is always safe.
config({ path: '.env.local' })

// Prisma 7 requires a driver adapter. PrismaNeon accepts PoolConfig directly.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
