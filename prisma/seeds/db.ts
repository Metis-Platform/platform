import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { config } from 'dotenv'
import ws from 'ws'
import { PrismaClient } from '../../app/generated/prisma'

export function createSeedPrismaClient() {
  neonConfig.webSocketConstructor = ws
  config({ path: '.env.local' })

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run seed scripts')
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}
