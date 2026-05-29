import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../app/generated/prisma'
import { config } from 'dotenv'
import ws from 'ws'

// Required: supply a WebSocket constructor when running in Node.js (not browser/edge)
neonConfig.webSocketConstructor = ws

config({ path: '.env.local' })

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

type RuleInput = {
  eventType: string
  label: string
  anchorField: string
  offsetDays: number
  sortOrder: number
  description: string
}

async function seedRuleSet(jurisdictionId: string, name: string, rules: RuleInput[]) {
  // Deactivate any existing active rule sets for this jurisdiction so we never
  // end up with two "isActive" sets pointing at the same jurisdiction.
  await prisma.ruleSet.updateMany({
    where: { jurisdictionId, isActive: true },
    data: { isActive: false },
  })

  const ruleSet = await prisma.ruleSet.create({
    data: {
      jurisdictionId,
      name,
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  for (const r of rules) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.rule.create({ data: { ruleSetId: ruleSet.id, ...(r as any) } })
  }

  console.log(`  Created: ${name} (${rules.length} rules)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding jurisdictions and rule sets...\n')

  // ── Florida — Orange County (Lien State) ──────────────────────────────────
  const fl = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'FL', county: 'Orange' } },
    update: {},
    create: { state: 'FL', stateName: 'Florida', county: 'Orange', timezone: 'America/New_York', investmentType: 'LIEN' },
  })
  await seedRuleSet(fl.id, 'Orange County FL — Standard Tax Lien Rules', [
    {
      eventType: 'NOTICE_MAIL_BY',
      label: 'Mail Certified Notice (30-day warning)',
      anchorField: 'issueDate',
      offsetDays: 700,
      sortOrder: 1,
      description: 'Send certified mail notice to owner 30 days before the 2-year redemption deadline.',
    },
    {
      eventType: 'REDEMPTION_DEADLINE',
      label: 'Redemption Deadline (2 Years)',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 2,
      description: "Owner's right to redeem expires 2 years after certificate issuance. FL Stat. § 197.502.",
    },
    {
      eventType: 'FORECLOSURE_ELIGIBLE',
      label: 'Eligible to Apply for Tax Deed',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 3,
      description: 'Lienholder may file a Tax Deed Application with the county Tax Collector after 2 years. FL Stat. § 197.502.',
    },
    {
      eventType: 'FORECLOSURE_DEADLINE',
      label: 'Lien Expiration — Must Act (7 Years)',
      anchorField: 'issueDate',
      offsetDays: 2555,
      sortOrder: 4,
      description: 'Certificate expires 7 years after issuance if no Tax Deed Application is filed. FL Stat. § 197.482.',
    },
  ])

  // ── New Jersey — Burlington County (Lien State) ───────────────────────────
  const nj = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'NJ', county: 'Burlington' } },
    update: {},
    create: { state: 'NJ', stateName: 'New Jersey', county: 'Burlington', timezone: 'America/New_York', investmentType: 'LIEN' },
  })
  await seedRuleSet(nj.id, 'Burlington County NJ — Standard Tax Lien Rules', [
    {
      eventType: 'NOTICE_MAIL_BY',
      label: 'Mail Notice of Intent to Foreclose',
      anchorField: 'issueDate',
      offsetDays: 700,
      sortOrder: 1,
      description: 'Certified mail notice to owner and interested parties 30 days before filing foreclosure complaint. N.J.S.A. 54:5-97.1.',
    },
    {
      eventType: 'REDEMPTION_DEADLINE',
      label: 'Redemption Deadline (2 Years)',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 2,
      description: "Owner's right to redeem expires 2 years after lien sale. N.J.S.A. 54:5-86.",
    },
    {
      eventType: 'FORECLOSURE_ELIGIBLE',
      label: 'Eligible to File Foreclosure Complaint',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 3,
      description: 'Lienholder may file foreclosure suit in Superior Court after the 2-year redemption period. N.J.S.A. 54:5-86.',
    },
    {
      eventType: 'FORECLOSURE_DEADLINE',
      label: 'Statute of Limitations (20 Years)',
      anchorField: 'issueDate',
      offsetDays: 7300,
      sortOrder: 4,
      description: 'Tax lien foreclosure action must be filed within 20 years of lien issuance. N.J.S.A. 54:5-30.',
    },
  ])

  // ── Illinois — Cook County (Lien State) ───────────────────────────────────
  const il = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'IL', county: 'Cook' } },
    update: {},
    create: { state: 'IL', stateName: 'Illinois', county: 'Cook', timezone: 'America/Chicago', investmentType: 'LIEN' },
  })
  await seedRuleSet(il.id, 'Cook County IL — Standard Tax Lien Rules', [
    {
      eventType: 'PUBLICATION_START',
      label: 'Begin Newspaper Publication Notice',
      anchorField: 'issueDate',
      offsetDays: 548,
      sortOrder: 1,
      description: 'Investor must publish notice in a newspaper of general circulation for 3 consecutive weeks. Earliest start is ~18 months after sale. 35 ILCS 200/22-10.',
    },
    {
      eventType: 'NOTICE_MAIL_BY',
      label: 'Mail Notice of Tax Deed Petition',
      anchorField: 'issueDate',
      offsetDays: 640,
      sortOrder: 2,
      description: 'Certified mail notice to owner and interested parties ~90 days before redemption deadline. 35 ILCS 200/22-10.',
    },
    {
      eventType: 'REDEMPTION_DEADLINE',
      label: 'Redemption Deadline (2 Years)',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 3,
      description: "Owner's right to redeem expires 2 years after tax sale (standard residential). 35 ILCS 200/21-350.",
    },
    {
      eventType: 'FORECLOSURE_ELIGIBLE',
      label: 'Eligible to Petition for Tax Deed',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 4,
      description: 'Investor may petition the Circuit Court for a Tax Deed after the redemption period expires. 35 ILCS 200/22-30.',
    },
  ])

  // ── Arizona — Maricopa County (Lien State) ────────────────────────────────
  const az = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'AZ', county: 'Maricopa' } },
    update: {},
    create: { state: 'AZ', stateName: 'Arizona', county: 'Maricopa', timezone: 'America/Phoenix', investmentType: 'LIEN' },
  })
  await seedRuleSet(az.id, 'Maricopa County AZ — Standard Tax Lien Rules', [
    {
      eventType: 'NOTICE_MAIL_BY',
      label: 'Mail Foreclosure Notice (30-day warning)',
      anchorField: 'issueDate',
      offsetDays: 1065,
      sortOrder: 1,
      description: 'Certified mail notice to owner 30 days before the 3-year redemption deadline. A.R.S. § 42-18201.',
    },
    {
      eventType: 'REDEMPTION_DEADLINE',
      label: 'Redemption Deadline (3 Years)',
      anchorField: 'issueDate',
      offsetDays: 1095,
      sortOrder: 2,
      description: "Owner's right to redeem expires 3 years after lien sale. A.R.S. § 42-18152.",
    },
    {
      eventType: 'FORECLOSURE_ELIGIBLE',
      label: 'Eligible to Foreclose',
      anchorField: 'issueDate',
      offsetDays: 1095,
      sortOrder: 3,
      description: 'Lienholder may initiate foreclosure after the 3-year redemption period. A.R.S. § 42-18201.',
    },
    {
      eventType: 'FORECLOSURE_DEADLINE',
      label: 'Lien Expiration (10 Years)',
      anchorField: 'issueDate',
      offsetDays: 3650,
      sortOrder: 4,
      description: 'Tax lien becomes void 10 years after issuance if not foreclosed. A.R.S. § 42-18122.',
    },
  ])

  // ── Texas — Harris County (Deed State) ────────────────────────────────────
  const tx = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'TX', county: 'Harris' } },
    update: {},
    create: { state: 'TX', stateName: 'Texas', county: 'Harris', timezone: 'America/Chicago', investmentType: 'DEED' },
  })
  await seedRuleSet(tx.id, 'Harris County TX — Standard Tax Deed Rules', [
    {
      eventType: 'FORECLOSURE_ELIGIBLE',
      label: 'Non-Homestead Redemption Expires (6 Months)',
      anchorField: 'issueDate',
      offsetDays: 180,
      sortOrder: 1,
      description: 'Non-homestead, non-agricultural properties: right of redemption expires 6 months after deed sale. Tex. Tax Code § 34.21(b).',
    },
    {
      eventType: 'REDEMPTION_DEADLINE',
      label: 'Homestead / Agriculture Redemption Expires (2 Years)',
      anchorField: 'issueDate',
      offsetDays: 730,
      sortOrder: 2,
      description: 'Homestead and agricultural properties: right of redemption expires 2 years after deed sale. Tex. Tax Code § 34.21(a).',
    },
  ])

  console.log('\nSeed complete. 5 jurisdictions created: FL, NJ, IL, AZ, TX')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
