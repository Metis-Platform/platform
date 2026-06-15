import { EventType, PrismaClient } from '../app/generated/prisma'
import { seedCounties } from './seeds/seed-counties'
import { seedStateProfiles } from './seeds/seed-state-profiles'
import { createSeedPrismaClient } from './seeds/db'

async function main() {
  const prisma = createSeedPrismaClient()

  try {
    console.log('Seeding counties from Census 2025 Gazetteer snapshot...')
    await seedCounties(prisma)

    console.log('\nSeeding state statutory jurisdiction profiles...')
    await seedStateProfiles(prisma)

    console.log('\nSeeding rule sets...')
    await seedRuleSets(prisma)

    console.log('\nSeed complete.')
  } finally {
    await prisma.$disconnect()
  }
}

type RuleInput = { eventType: EventType; label: string; anchorField: string; offsetDays: number; sortOrder: number; description: string }

async function seedRuleSets(prisma: PrismaClient) {
  const fl = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'FL', county: 'Orange' } } })
  const nj = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'NJ', county: 'Burlington' } } })
  const il = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'IL', county: 'Cook' } } })
  const az = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'AZ', county: 'Maricopa' } } })
  const tx = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'TX', county: 'Harris' } } })
  const gaFulton = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'GA', county: 'Fulton' } } })
  const gaGwinnett = await prisma.jurisdiction.findUniqueOrThrow({ where: { state_county: { state: 'GA', county: 'Gwinnett' } } })

  await seedRuleSet(prisma, fl.id, 'Orange County FL — Standard Tax Lien Rules', [
    { eventType: EventType.NOTICE_MAIL_BY,       label: 'Mail Certified Notice (30-day warning)',  anchorField: 'issueDate', offsetDays: 700,  sortOrder: 1, description: 'Certified mail notice to owner 30 days before 2-year redemption deadline.' },
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: "Owner's right to redeem expires 2 years after certificate issuance. FL Stat. § 197.502." },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to Apply for Tax Deed',           anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: 'Lienholder may file a Tax Deed Application with the county Tax Collector after 2 years. FL Stat. § 197.502.' },
    { eventType: EventType.FORECLOSURE_DEADLINE, label: 'Lien Expiration — Must Act (7 Years)',     anchorField: 'issueDate', offsetDays: 2555, sortOrder: 4, description: 'Certificate expires 7 years after issuance if no Tax Deed Application is filed. FL Stat. § 197.482.' },
  ])

  await seedRuleSet(prisma, nj.id, 'Burlington County NJ — Standard Tax Lien Rules', [
    { eventType: EventType.NOTICE_MAIL_BY,       label: 'Mail Notice of Intent to Foreclose',      anchorField: 'issueDate', offsetDays: 700,  sortOrder: 1, description: 'Certified mail notice 30 days before filing foreclosure complaint. N.J.S.A. 54:5-97.1.' },
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: "Owner's right to redeem expires 2 years after lien sale. N.J.S.A. 54:5-86." },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to File Foreclosure Complaint',   anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: 'Lienholder may file foreclosure suit in Superior Court. N.J.S.A. 54:5-86.' },
    { eventType: EventType.FORECLOSURE_DEADLINE, label: 'Statute of Limitations (20 Years)',        anchorField: 'issueDate', offsetDays: 7300, sortOrder: 4, description: 'Foreclosure action must be filed within 20 years. N.J.S.A. 54:5-30.' },
  ])

  await seedRuleSet(prisma, il.id, 'Cook County IL — Standard Tax Lien Rules', [
    { eventType: EventType.PUBLICATION_START,    label: 'Begin Newspaper Publication Notice',       anchorField: 'issueDate', offsetDays: 548,  sortOrder: 1, description: 'Publish notice 3 consecutive weeks, earliest ~18 months after sale. 35 ILCS 200/22-10.' },
    { eventType: EventType.NOTICE_MAIL_BY,       label: 'Mail Notice of Tax Deed Petition',         anchorField: 'issueDate', offsetDays: 640,  sortOrder: 2, description: 'Certified mail ~90 days before redemption deadline. 35 ILCS 200/22-10.' },
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Redemption Deadline (2 Years)',            anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: "Owner's right to redeem expires 2 years after tax sale. 35 ILCS 200/21-350." },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to Petition for Tax Deed',        anchorField: 'issueDate', offsetDays: 730,  sortOrder: 4, description: 'Investor may petition Circuit Court for Tax Deed. 35 ILCS 200/22-30.' },
  ])

  await seedRuleSet(prisma, az.id, 'Maricopa County AZ — Standard Tax Lien Rules', [
    { eventType: EventType.NOTICE_MAIL_BY,       label: 'Mail Foreclosure Notice (30-day warning)', anchorField: 'issueDate', offsetDays: 1065, sortOrder: 1, description: 'Certified mail notice 30 days before 3-year redemption deadline. A.R.S. § 42-18201.' },
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Redemption Deadline (3 Years)',            anchorField: 'issueDate', offsetDays: 1095, sortOrder: 2, description: "Owner's right to redeem expires 3 years after lien sale. A.R.S. § 42-18152." },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to Foreclose',                    anchorField: 'issueDate', offsetDays: 1095, sortOrder: 3, description: 'Lienholder may initiate foreclosure. A.R.S. § 42-18201.' },
    { eventType: EventType.FORECLOSURE_DEADLINE, label: 'Lien Expiration (10 Years)',               anchorField: 'issueDate', offsetDays: 3650, sortOrder: 4, description: 'Tax lien becomes void 10 years after issuance. A.R.S. § 42-18122.' },
  ])

  await seedRuleSet(prisma, tx.id, 'Harris County TX — Standard Tax Deed Rules', [
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Non-Homestead Redemption Expires (6 Mo)',  anchorField: 'issueDate', offsetDays: 180,  sortOrder: 1, description: 'Non-homestead right of redemption expires 6 months after deed sale. Tex. Tax Code § 34.21(b).' },
    { eventType: EventType.REDEMPTION_DEADLINE,  label: 'Homestead Redemption Expires (2 Years)',   anchorField: 'issueDate', offsetDays: 730,  sortOrder: 2, description: 'Homestead/agricultural right of redemption expires 2 years after deed sale. Tex. Tax Code § 34.21(a).' },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to Foreclose (After Homestead Window)', anchorField: 'issueDate', offsetDays: 730,  sortOrder: 3, description: 'Investor may initiate foreclosure after all redemption periods have expired. Tex. Tax Code § 34.21.' },
  ])

  const gaRules = [
    { eventType: EventType.NOTICE_MAIL_BY,      label: 'Mail Notice of Right to Redeem',          anchorField: 'saleDate', offsetDays: 30,  sortOrder: 1, description: 'Purchaser must notify record title holders of right to redeem within 30 days. O.C.G.A. § 48-4-45.' },
    { eventType: EventType.REDEMPTION_DEADLINE, label: 'Redemption Deadline (1 Year)',             anchorField: 'saleDate', offsetDays: 365, sortOrder: 2, description: "Owner's right to redeem expires 1 year from date of sale. O.C.G.A. § 48-4-40." },
    { eventType: EventType.FORECLOSURE_ELIGIBLE, label: 'Eligible to Foreclose Equity of Redemption', anchorField: 'saleDate', offsetDays: 365, sortOrder: 3, description: 'After redemption deadline, purchaser may file to bar equity of redemption. O.C.G.A. § 48-4-46.' },
  ]
  await seedRuleSet(prisma, gaFulton.id,   'Fulton County GA — Tax Deed Rules',   gaRules)
  await seedRuleSet(prisma, gaGwinnett.id, 'Gwinnett County GA — Tax Deed Rules', gaRules)
}

async function seedRuleSet(prisma: PrismaClient, jurisdictionId: string, name: string, rules: RuleInput[]) {
  const existing = await prisma.ruleSet.findFirst({ where: { jurisdictionId, isActive: true } })
  if (existing) { console.log(`  Skipped (exists): ${name}`); return }
  const ruleSet = await prisma.ruleSet.create({ data: { jurisdictionId, name, effectiveDate: new Date('2024-01-01'), isActive: true } })
  for (const r of rules) {
    await prisma.rule.create({ data: { ruleSetId: ruleSet.id, eventType: r.eventType, label: r.label, anchorField: r.anchorField, offsetDays: r.offsetDays, sortOrder: r.sortOrder, description: r.description } })
  }
  await prisma.jurisdiction.update({ where: { id: jurisdictionId }, data: { isAvailable: true } })
  console.log(`  Created: ${name}`)
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
