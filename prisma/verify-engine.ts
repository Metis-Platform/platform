/**
 * verify-engine.ts — one-shot integration test for the rules engine.
 * Run: tsx prisma/verify-engine.ts
 * Cleans up all test data before and after.
 */
import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient, StrategyType, DealStatus } from '../app/generated/prisma'
import { generateEventsForDeal } from '../lib/rules-engine'
import ws from 'ws'

// Required for WebSocket in Node.js (lib/db.ts will also configure this via neonConfig,
// but we set it here too so the local prisma client below also works)
neonConfig.webSocketConstructor = ws

// lib/db.ts loads dotenv automatically — no need to call config() here

// Use a standalone Prisma client so we can share the ws-configured neonConfig
const localPrisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
})

const TEST_APN = 'TEST-APN-VERIFY-ENGINE'

async function cleanup(tenantId?: string) {
  if (!tenantId) return
  // Clean up any leftover deals → events cascade-delete automatically
  const props = await localPrisma.property.findMany({ where: { tenantId, apn: TEST_APN } })
  for (const p of props) {
    await localPrisma.deal.deleteMany({ where: { propertyId: p.id } })
  }
  await localPrisma.property.deleteMany({ where: { tenantId, apn: TEST_APN } })
}

async function main() {
  console.log('=== Rules Engine Verification ===\n')

  // Find FL jurisdiction
  const fl = await localPrisma.jurisdiction.findUnique({
    where: { state_county: { state: 'FL', county: 'Orange' } },
  })
  if (!fl) throw new Error('FL jurisdiction not found — run: npm run db:seed')

  // Use existing tenant (from dashboard visit) or create a temporary test tenant
  let tenant = await localPrisma.tenant.findFirst()
  let ownedTenant = false
  if (!tenant) {
    tenant = await localPrisma.tenant.create({
      data: { clerkOrgId: 'test-verify-tmp', name: 'Verify Tenant', slug: 'verify-tenant-tmp', plan: 'STARTER' },
    })
    ownedTenant = true
  }

  // Pre-cleanup (in case a prior run failed mid-way)
  await cleanup(tenant.id)

  // Issue date 400 days ago: NOTICE_MAIL_BY (700d) and REDEMPTION_DEADLINE (730d) are still
  // in the future, so all 4 FL events should be PENDING.
  const issueDate = new Date()
  issueDate.setDate(issueDate.getDate() - 400)

  const property = await localPrisma.property.create({
    data: {
      tenantId: tenant.id,
      jurisdictionId: fl.id,
      apn: TEST_APN,
      address: '123 Verify St',
      city: 'Orlando',
      state: 'FL',
      zip: '32801',
    },
  })

  const deal = await localPrisma.deal.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      strategyType: StrategyType.TAX_LIEN,
      status: DealStatus.ACTIVE,
      taxLien: {
        create: {
          certificateNumber: 'TEST-CERT-VERIFY-2024',
          faceAmount: 5000,
          interestRate: 0.18,
          issueDate,
        },
      },
    },
  })

  console.log(`Deal: ${deal.id}`)
  console.log(`Issue date: ${issueDate.toDateString()} (400 days ago)\n`)

  // Run the engine (uses lib/db singleton — DATABASE_URL loaded via dotenv in lib/db.ts)
  const eventCount = await generateEventsForDeal(deal.id, tenant.id)
  console.log(`Generated ${eventCount} events:\n`)

  const events = await localPrisma.event.findMany({
    where: { dealId: deal.id },
    orderBy: { dueDate: 'asc' },
  })

  for (const e of events) {
    const daysFromNow = Math.round((e.dueDate.getTime() - Date.now()) / 86400000)
    const sign = daysFromNow >= 0 ? `+${daysFromNow}d` : `${daysFromNow}d`
    console.log(`  [${e.status.padEnd(7)}] ${e.label}`)
    console.log(`           Due: ${e.dueDate.toDateString()} (${sign})`)
  }

  // For a 400-day-old FL lien: all 4 events are in the future → all PENDING
  console.log('\n--- Assertions ---')
  const overdueEvents = events.filter((e) => e.status === 'OVERDUE')
  const pendingEvents = events.filter((e) => e.status === 'PENDING')
  const passes = overdueEvents.length === 0 && pendingEvents.length === 4

  console.log(`OVERDUE: ${overdueEvents.length} (expected 0)`)
  console.log(`PENDING: ${pendingEvents.length} (expected 4)`)

  if (passes) {
    console.log('\n✅ PASS — rules engine generates correct events and statuses')
  } else {
    console.log('\n❌ FAIL — unexpected results')
    process.exitCode = 1
  }

  // Cleanup
  await cleanup(tenant.id)
  if (ownedTenant) await localPrisma.tenant.delete({ where: { id: tenant.id } })
  console.log('Test data cleaned up.')
}

main()
  .catch((e) => {
    console.error('\nVerify failed:', e)
    process.exit(1)
  })
  .finally(() => localPrisma.$disconnect())
