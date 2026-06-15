import { pathToFileURL } from 'url'
import { createSeedPrismaClient } from './db'
import type { Prisma, PrismaClient } from '../../app/generated/prisma'
import { buildStateProfileBaseline, type StateProfileBaseline } from './state-profile-baseline'

type JsonObject = Record<string, Prisma.InputJsonValue>

type ProfileSection = keyof StateProfileBaseline

const PROFILE_SECTIONS: ProfileSection[] = ['taxSale', 'foreclosure', 'landlordTenant', 'wholesale']

function mergeSection(existing: unknown, baseline: JsonObject): JsonObject {
  const current = isObject(existing) ? existing as JsonObject : {}
  const next: JsonObject = { ...current }

  for (const [key, value] of Object.entries(baseline)) {
    const existingField = current[key]
    const existingConfidence = isObject(existingField) && typeof existingField.confidence === 'number'
      ? existingField.confidence
      : null

    const humanVerified = isObject(existingField) && existingField.verifiedById && existingField.verifiedById !== 'system'
    if ((existingConfidence !== null && existingConfidence > 1) || humanVerified) {
      continue
    }

    next[key] = value
  }

  return next
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function seedStateProfiles(prisma: PrismaClient) {
  const jurisdictions = await prisma.jurisdiction.findMany({
    select: {
      id: true,
      state: true,
      profile: {
        select: {
          taxSale: true,
          foreclosure: true,
          landlordTenant: true,
          wholesale: true,
          publishedSections: true,
        },
      },
    },
    orderBy: [{ state: 'asc' }, { county: 'asc' }],
  })

  let created = 0
  let updated = 0
  const operations: Prisma.PrismaPromise<unknown>[] = []

  for (const jurisdiction of jurisdictions) {
    const baseline = buildStateProfileBaseline(jurisdiction.state)
    const existing = jurisdiction.profile

    const data = {
      taxSale: mergeSection(existing?.taxSale, baseline.taxSale),
      foreclosure: mergeSection(existing?.foreclosure, baseline.foreclosure),
      landlordTenant: mergeSection(existing?.landlordTenant, baseline.landlordTenant),
      wholesale: mergeSection(existing?.wholesale, baseline.wholesale),
      publishedSections: Array.from(new Set([...(existing?.publishedSections ?? []), ...PROFILE_SECTIONS])),
    }

    if (!existing) {
      operations.push(prisma.jurisdictionProfile.create({
        data: { jurisdictionId: jurisdiction.id, ...data },
      }))
      created++
    } else {
      operations.push(prisma.jurisdictionProfile.update({
        where: { jurisdictionId: jurisdiction.id },
        data,
      }))
      updated++
    }
  }

  for (let i = 0; i < operations.length; i += 50) {
    await prisma.$transaction(operations.slice(i, i + 50))
  }

  const [profileCount, jurisdictionCount] = await Promise.all([
    prisma.jurisdictionProfile.count(),
    prisma.jurisdiction.count(),
  ])
  if (profileCount !== jurisdictionCount) {
    throw new Error(`Jurisdiction profile seed verification failed: ${profileCount} profiles for ${jurisdictionCount} jurisdictions`)
  }

  console.log(`Jurisdiction profiles: ${created} created, ${updated} updated`)
}


async function main() {
  const prisma = createSeedPrismaClient()
  try {
    await seedStateProfiles(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
}
