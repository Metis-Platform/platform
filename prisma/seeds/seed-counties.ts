import { readFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createSeedPrismaClient } from './db'
import type { PrismaClient } from '../../app/generated/prisma'
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

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const row of counties) {
    const existing = await prisma.jurisdiction.findFirst({
      where: {
        OR: [
          { fips: row.fips },
          { state: row.state, county: row.county },
        ],
      },
    })

    const data = {
      state: row.state,
      stateName: row.stateName,
      county: row.county,
      fips: row.fips,
      timezone: row.timezone,
      investmentType: InvestmentType[row.type],
    }

    if (!existing) {
      await prisma.jurisdiction.create({ data })
      created++
      continue
    }

    const needsUpdate =
      existing.fips !== row.fips ||
      existing.state !== row.state ||
      existing.stateName !== row.stateName ||
      existing.county !== row.county ||
      existing.timezone !== row.timezone ||
      existing.investmentType !== InvestmentType[row.type]

    if (needsUpdate) {
      await prisma.jurisdiction.update({ where: { id: existing.id }, data })
      updated++
    } else {
      unchanged++
    }
  }

  const total = await prisma.jurisdiction.count()
  const missingFips = await prisma.jurisdiction.count({ where: { fips: null } })
  if (total !== counties.length || missingFips !== 0) {
    throw new Error(`County seed verification failed: expected ${counties.length} jurisdictions and 0 missing FIPS; got ${total} jurisdictions and ${missingFips} missing FIPS`)
  }
  console.log(`Jurisdictions: ${created} created, ${updated} updated, ${unchanged} unchanged (${total} total, ${missingFips} missing FIPS)`)
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
