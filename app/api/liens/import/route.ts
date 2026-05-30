import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { StrategyType, DealStatus } from '@/app/generated/prisma'
import { parseCsv, rowsToObjects } from '@/lib/csv'

// ---------------------------------------------------------------------------
// Row schema
// ---------------------------------------------------------------------------

const RowSchema = z.object({
  state:              z.string().length(2, 'Must be a 2-letter state code (e.g. FL)').transform(v => v.toUpperCase()),
  county:             z.string().min(1, 'Required'),
  apn:                z.string().min(1, 'Required').max(60),
  certificate_number: z.string().min(1, 'Required').max(60),
  face_amount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be > 0'),
  interest_rate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100),
  issue_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  address:            z.string().max(200).optional(),
  notes:              z.string().max(2000).optional(),
})

export type ImportRow = {
  rowNum: number
  raw: Record<string, string>
  valid: boolean
  errors: string[]
  data?: z.infer<typeof RowSchema>
}

// ---------------------------------------------------------------------------
// POST /api/liens/import
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
  const { tenant } = synced

  const url = new URL(req.url)
  const preview = url.searchParams.get('preview') === 'true'

  // Parse multipart form with CSV file
  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rawRows = parseCsv(text)
  const objects = rowsToObjects(rawRows)

  if (objects.length === 0) return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })
  if (objects.length > 500) return NextResponse.json({ error: 'Max 500 rows per import' }, { status: 400 })

  // Load jurisdictions for this import's states (to resolve state+county → jurisdictionId)
  const states = [...new Set(objects.map(o => (o.state ?? '').toUpperCase()))]
  const jurisdictions = await db.jurisdiction.findMany({
    where: { state: { in: states } },
    select: { id: true, state: true, county: true },
  })
  const jurMap = new Map(jurisdictions.map(j => [`${j.state}::${j.county.toLowerCase()}`, j.id]))

  // Validate each row
  const rows: ImportRow[] = objects.map((obj, i) => {
    const rowNum = i + 2 // 1-indexed, +1 for header
    const parsed = RowSchema.safeParse(obj)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      return { rowNum, raw: obj, valid: false, errors }
    }
    const data = parsed.data
    const jurKey = `${data.state}::${data.county.toLowerCase()}`
    const jurId = jurMap.get(jurKey)
    if (!jurId) {
      return { rowNum, raw: obj, valid: false, errors: [`Jurisdiction not found: ${data.county}, ${data.state}`] }
    }
    return { rowNum, raw: obj, valid: true, errors: [], data: { ...data } }
  })

  if (preview) {
    return NextResponse.json({ rows, total: rows.length, valid: rows.filter(r => r.valid).length })
  }

  // --- Import phase ---
  const validRows = rows.filter(r => r.valid && r.data)
  let imported = 0
  const importErrors: { rowNum: number; error: string }[] = []

  for (const row of validRows) {
    const d = row.data!
    const jurKey = `${d.state}::${d.county.toLowerCase()}`
    const jurId = jurMap.get(jurKey)!

    try {
      const property = await db.property.upsert({
        where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: d.apn, jurisdictionId: jurId } },
        update: { ...(d.address ? { address: d.address } : {}) },
        create: { tenantId: tenant.id, jurisdictionId: jurId, apn: d.apn, ...(d.address ? { address: d.address } : {}) },
      })

      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          strategyType: StrategyType.TAX_LIEN,
          status: DealStatus.ACTIVE,
          notes: d.notes || null,
          taxLien: {
            create: {
              certificateNumber: d.certificate_number,
              faceAmount: d.face_amount,
              interestRate: d.interest_rate / 100,
              issueDate: new Date(`${d.issue_date}T12:00:00.000Z`),
            },
          },
        },
      })

      await generateEventsForDeal(deal.id, tenant.id)
      imported++
    } catch (err) {
      importErrors.push({ rowNum: row.rowNum, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ imported, skipped: importErrors.length, errors: importErrors })
}
