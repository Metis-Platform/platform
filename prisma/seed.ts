import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../app/generated/prisma'
import { config } from 'dotenv'
import ws from 'ws'
import { readFileSync } from 'fs'
import { join } from 'path'

neonConfig.webSocketConstructor = ws
config({ path: '.env.local' })

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type CountyRow = { state: string; stateName: string; county: string; timezone: string; type: string }

async function main() {
  console.log('Seeding jurisdictions from us-counties.json...\n')

  const counties: CountyRow[] = JSON.parse(
    readFileSync(join(__dirname, 'us-counties.json'), 'utf-8')
  )

  let created = 0
  let skipped = 0
  for (const row of counties) {
    const result = await prisma.jurisdiction.upsert({
      where: { state_county: { state: row.state, county: row.county } },
      update: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { state: row.state, stateName: row.stateName, county: row.county, timezone: row.timezone, investmentType: row.type as any },
    })
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
    else skipped++
  }
  console.log(`Jurisdictions: ${created} created, ${skipped} already existed`)

  // Seed rule sets for the 5 key jurisdictions (idempotent)
  console.log('\nSeeding rule sets...\n')

  const fl = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'FL', county: 'Orange' } } })
  const nj = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'NJ', county: 'Burlington' } } })
  const il = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'IL', county: 'Cook' } } })
  const az = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'AZ', county: 'Maricopa' } } })
  const tx = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'TX', county: 'Harris' } } })

  // Georgia tax deed jurisdictions
  const gaFulton = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'GA', county: 'Fulton' } },
    update: {},
    create: { state: 'GA', stateName: 'Georgia', county: 'Fulton', timezone: 'America/New_York', investmentType: 'DEED' },
  })
  const gaGwinnett = await prisma.jurisdiction.upsert({
    where: { state_county: { state: 'GA', county: 'Gwinnett' } },
    update: {},
    create: { state: 'GA', stateName: 'Georgia', county: 'Gwinnett', timezone: 'America/New_York', investmentType: 'DEED' },
  })

  await seedRuleSet(fl.id, 'Orange County FL — Standard Tax Lien Rules', [
    { eventType: 'NOTICE_MAIL_BY',       label: 'Mail Certified Notice (30-day warning)',  anchorField: 'issueDate', offsetDays: 700,  sortOrder: 1, description: 'Certified mail notice to owner 30 days before 2-year redemption deadline.' },
    { eventType: 'REDEMPTION_DEADLINE',  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: "Owner's right to redeem expires 2 years after certificate issuance. FL Stat. § 197.502." },
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Eligible to Apply for Tax Deed',           anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: 'Lienholder may file a Tax Deed Application with the county Tax Collector after 2 years. FL Stat. § 197.502.' },
    { eventType: 'FORECLOSURE_DEADLINE', label: 'Lien Expiration — Must Act (7 Years)',     anchorField: 'issueDate', offsetDays: 2555, sortOrder: 4, description: 'Certificate expires 7 years after issuance if no Tax Deed Application is filed. FL Stat. § 197.482.' },
  ])

  await seedRuleSet(nj.id, 'Burlington County NJ — Standard Tax Lien Rules', [
    { eventType: 'NOTICE_MAIL_BY',       label: 'Mail Notice of Intent to Foreclose',      anchorField: 'issueDate', offsetDays: 700,  sortOrder: 1, description: 'Certified mail notice 30 days before filing foreclosure complaint. N.J.S.A. 54:5-97.1.' },
    { eventType: 'REDEMPTION_DEADLINE',  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: "Owner's right to redeem expires 2 years after lien sale. N.J.S.A. 54:5-86." },
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Eligible to File Foreclosure Complaint',   anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: 'Lienholder may file foreclosure suit in Superior Court. N.J.S.A. 54:5-86.' },
    { eventType: 'FORECLOSURE_DEADLINE', label: 'Statute of Limitations (20 Years)',        anchorField: 'issueDate', offsetDays: 7300, sortOrder: 4, description: 'Foreclosure action must be filed within 20 years. N.J.S.A. 54:5-30.' },
  ])

  await seedRuleSet(il.id, 'Cook County IL — Standard Tax Lien Rules', [
    { eventType: 'PUBLICATION_START',    label: 'Begin Newspaper Publication Notice',       anchorField: 'issueDate', offsetDays: 548,  sortOrder: 1, description: 'Publish notice 3 consecutive weeks, earliest ~18 months after sale. 35 ILCS 200/22-10.' },
    { eventType: 'NOTICE_MAIL_BY',       label: 'Mail Notice of Tax Deed Petition',         anchorField: 'issueDate', offsetDays: 640,  sortOrder: 2, description: 'Certified mail ~90 days before redemption deadline. 35 ILCS 200/22-10.' },
    { eventType: 'REDEMPTION_DEADLINE',  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: "Owner's right to redeem expires 2 years after tax sale. 35 ILCS 200/21-350." },
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Eligible to Petition for Tax Deed',        anchorField: 'issueDate', offsetDays: 730,  sortOrder: 4, description: 'Investor may petition Circuit Court for Tax Deed. 35 ILCS 200/22-30.' },
  ])

  await seedRuleSet(az.id, 'Maricopa County AZ — Standard Tax Lien Rules', [
    { eventType: 'NOTICE_MAIL_BY',       label: 'Mail Foreclosure Notice (30-day warning)', anchorField: 'issueDate', offsetDays: 1065, sortOrder: 1, description: 'Certified mail notice 30 days before 3-year redemption deadline. A.R.S. § 42-18201.' },
    { eventType: 'REDEMPTION_DEADLINE',  label: 'Redemption Deadline (3 Years)',            anchorField: 'issueDate', offsetDays: 1095, sortOrder: 2, description: "Owner's right to redeem expires 3 years after lien sale. A.R.S. § 42-18152." },
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Eligible to Foreclose',                    anchorField: 'issueDate', offsetDays: 1095, sortOrder: 3, description: 'Lienholder may initiate foreclosure. A.R.S. § 42-18201.' },
    { eventType: 'FORECLOSURE_DEADLINE', label: 'Lien Expiration (10 Years)',               anchorField: 'issueDate', offsetDays: 3650, sortOrder: 4, description: 'Tax lien becomes void 10 years after issuance. A.R.S. § 42-18122.' },
  ])

  await seedRuleSet(tx.id, 'Harris County TX — Standard Tax Deed Rules', [
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Non-Homestead Redemption Expires (6 Mo)',  anchorField: 'issueDate', offsetDays: 180,  sortOrder: 1, description: 'Non-homestead right of redemption expires 6 months after deed sale. Tex. Tax Code § 34.21(b).' },
    { eventType: 'REDEMPTION_DEADLINE',  label: 'Homestead Redemption Expires (2 Years)',   anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: 'Homestead/agricultural right of redemption expires 2 years after deed sale. Tex. Tax Code § 34.21(a).' },
  ])

  // GA Tax Deed rules — redemption period is 1 year (O.C.G.A. § 48-4-40)
  const gaRules = [
    { eventType: 'NOTICE_MAIL_BY',      label: 'Mail Notice of Right to Redeem',          anchorField: 'saleDate', offsetDays: 30,  sortOrder: 1, description: 'Purchaser must notify record title holders of right to redeem within 30 days. O.C.G.A. § 48-4-45.' },
    { eventType: 'REDEMPTION_DEADLINE', label: 'Redemption Deadline (1 Year)',             anchorField: 'saleDate', offsetDays: 365, sortOrder: 2, description: "Owner's right to redeem expires 1 year from date of sale. O.C.G.A. § 48-4-40." },
    { eventType: 'FORECLOSURE_ELIGIBLE', label: 'Eligible to Foreclose Equity of Redemption', anchorField: 'saleDate', offsetDays: 365, sortOrder: 3, description: 'After redemption deadline, purchaser may file to bar equity of redemption. O.C.G.A. § 48-4-46.' },
  ]
  await seedRuleSet(gaFulton.id,   'Fulton County GA — Tax Deed Rules',   gaRules)
  await seedRuleSet(gaGwinnett.id, 'Gwinnett County GA — Tax Deed Rules', gaRules)

  console.log('\nSeed complete.')
}

type RuleInput = { eventType: string; label: string; anchorField: string; offsetDays: number; sortOrder: number; description: string }

async function seedRuleSet(jurisdictionId: string, name: string, rules: RuleInput[]) {
  const existing = await prisma.ruleSet.findFirst({ where: { jurisdictionId, isActive: true } })
  if (existing) { console.log(`  Skipped (exists): ${name}`); return }
  await prisma.ruleSet.updateMany({ where: { jurisdictionId, isActive: true }, data: { isActive: false } })
  const ruleSet = await prisma.ruleSet.create({ data: { jurisdictionId, name, effectiveDate: new Date('2024-01-01'), isActive: true } })
  for (const r of rules) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.rule.create({ data: { ruleSetId: ruleSet.id, ...(r as any) } })
  }
  console.log(`  Created: ${name}`)
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
