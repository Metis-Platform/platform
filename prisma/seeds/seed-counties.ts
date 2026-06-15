import { readFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createSeedPrismaClient } from './db'
import type { Prisma, PrismaClient } from '../../app/generated/prisma'
import { InvestmentType } from '../../app/generated/prisma'

type CountyRow = {
  state: string
  stateName: string
  county: string
  fips: string
  timezone: string
  type: keyof typeof InvestmentType
}

export async function seedCounties(prisma: PrismaClient) {
  const counties: CountyRow[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'us-counties.json'), 'utf-8')
  )

  assertCountyRows(counties)

  // Load all existing jurisdictions once — avoids N×3 round-trips and OR-match ambiguity.
  // Match priority: FIPS first (stable Census identifier), then state+county name.
  const allExisting = await prisma.jurisdiction.findMany({
    select: { id: true, fips: true, state: true, county: true, stateName: true, timezone: true, investmentType: true },
  })
  const byFips = new Map(allExisting.filter(j => j.fips).map(j => [j.fips!, j]))
  const byStateCounty = new Map(allExisting.map(j => [`${j.state}:${j.county}`, j]))

  let created = 0
  let updated = 0
  let unchanged = 0

  const createOps: Prisma.PrismaPromise<unknown>[] = []
  const updateOps: Prisma.PrismaPromise<unknown>[] = []

  for (const row of counties) {
    const existing = byFips.get(row.fips) ?? byStateCounty.get(`${row.state}:${row.county}`)
    const data = {
      state: row.state,
      stateName: row.stateName,
      county: row.county,
      fips: row.fips,
      timezone: row.timezone,
      investmentType: InvestmentType[row.type],
    }

    if (!existing) {
      createOps.push(prisma.jurisdiction.create({ data }))
      created++
      continue
    }

    const needsUpdate =
      existing.fips !== row.fips ||
      existing.stateName !== row.stateName ||
      existing.timezone !== row.timezone ||
      existing.investmentType !== InvestmentType[row.type]

    if (needsUpdate) {
      updateOps.push(prisma.jurisdiction.update({ where: { id: existing.id }, data }))
      updated++
    } else {
      unchanged++
    }
  }

  for (let i = 0; i < createOps.length; i += 50) {
    await prisma.$transaction(createOps.slice(i, i + 50))
  }
  for (let i = 0; i < updateOps.length; i += 50) {
    await prisma.$transaction(updateOps.slice(i, i + 50))
  }

  // Verify all seeded counties are present — scoped to seed FIPS only so extra
  // rows (manual admin entries, test data) don't cause false failures.
  const seededCount = await prisma.jurisdiction.count({
    where: { fips: { in: counties.map(c => c.fips) } },
  })
  if (seededCount !== counties.length) {
    throw new Error(`County seed verification failed: expected ${counties.length} FIPS-tagged jurisdictions; got ${seededCount}`)
  }
  console.log(`Jurisdictions: ${created} created, ${updated} updated, ${unchanged} unchanged (${seededCount} total with FIPS)`)
}

function assertCountyRows(counties: CountyRow[]) {
  const fips = new Set<string>()
  const stateCounty = new Set<string>()

  for (const row of counties) {
    if (!/^\d{5}$/.test(row.fips)) {
      throw new Error(`Invalid FIPS for ${row.state} ${row.county}: ${row.fips}`)
    }

    const countyKey = `${row.state}:${row.county}`
    if (fips.has(row.fips) || stateCounty.has(countyKey)) {
      throw new Error(`Duplicate county seed row: ${row.state} ${row.county} (${row.fips})`)
    }

    fips.add(row.fips)
    stateCounty.add(countyKey)
  }

  if (counties.length !== 3143) {
    throw new Error(`Expected 3,143 Census county rows, found ${counties.length}`)
  }
}


async function main() {
  const prisma = createSeedPrismaClient()
  try {
    await seedCounties(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
}
