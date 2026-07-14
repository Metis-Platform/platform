import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { StrategyType, DealStatus } from '@/app/generated/prisma'
import { assertCsvUpload, exceedsDeclaredCsvUploadSize, ImportCsvError, parseImportCsv } from '@/lib/import-csv'
import { requestIdFromHeaders } from '@/lib/request-correlation'

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

const IMPORTABLE_STATUSES = ['LEAD', 'ACTIVE', 'NOT_WON', 'REDEEMED', 'FORECLOSURE_INITIATED', 'DEEDED'] as const
type ImportStatus = typeof IMPORTABLE_STATUSES[number]

const STATUS_VALID_MSG = `Valid values: ${IMPORTABLE_STATUSES.join(', ')}`
const IMPORT_REQUEST_ACTION = 'LIEN_IMPORT_REQUEST'

const dealStatusMap: Record<ImportStatus, DealStatus> = {
  LEAD:                   DealStatus.LEAD,
  ACTIVE:                 DealStatus.ACTIVE,
  NOT_WON:               DealStatus.NOT_WON,
  REDEEMED:              DealStatus.REDEEMED,
  FORECLOSURE_INITIATED: DealStatus.FORECLOSURE_INITIATED,
  DEEDED:                DealStatus.DEEDED,
}

// ---------------------------------------------------------------------------
// Row schema — cert fields optional; status determines requirements
// ---------------------------------------------------------------------------

const RowSchema = z.object({
  state:              z.string().length(2, 'Must be a 2-letter state code (e.g. FL)').transform(v => v.toUpperCase()),
  county:             z.string().min(1, 'Required'),
  apn:                z.string().min(1, 'Required').max(60),
  certificate_number: z.string().max(60).optional().transform(v => v || undefined),
  face_amount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be > 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v as number | undefined),
  interest_rate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : v as number | undefined),
  issue_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().or(z.literal('')).transform(v => v || undefined),
  address:            z.string().max(200).optional().transform(v => v || undefined),
  notes:              z.string().max(2000).optional().transform(v => v || undefined),
})

export type ImportRow = {
  rowNum: number
  raw: Record<string, string>
  valid: boolean
  errors: string[]
  data?: z.infer<typeof RowSchema> & { effectiveStatus: ImportStatus }
}

// ---------------------------------------------------------------------------
// File parsing — CSV only. XLS/XLSX is intentionally not accepted because the
// previously used parser has unresolved high-severity advisories for untrusted files.
// ---------------------------------------------------------------------------

async function parseFile(file: File): Promise<Record<string, string>[]> {
  assertCsvUpload(file)
  return parseImportCsv(await file.text())
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function resolveStatus(obj: Record<string, string>, data: z.infer<typeof RowSchema>): ImportStatus {
  const raw = (obj.status ?? '').trim().toUpperCase()
  if (raw) return raw as ImportStatus
  return data.certificate_number && data.face_amount != null && data.interest_rate != null && data.issue_date
    ? 'ACTIVE'
    : 'LEAD'
}

function validateStatusFields(status: ImportStatus, data: z.infer<typeof RowSchema>): string[] {
  const errs: string[] = []
  if (status === 'ACTIVE') {
    if (!data.certificate_number) errs.push('certificate_number: Required for ACTIVE')
    if (data.face_amount == null)  errs.push('face_amount: Required for ACTIVE')
    if (data.interest_rate == null) errs.push('interest_rate: Required for ACTIVE')
    if (!data.issue_date)          errs.push('issue_date: Required for ACTIVE')
  } else if (status === 'REDEEMED' || status === 'FORECLOSURE_INITIATED' || status === 'DEEDED') {
    if (!data.certificate_number) errs.push(`certificate_number: Required for ${status}`)
  }
  return errs
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

  if (exceedsDeclaredCsvUploadSize(req.headers.get('content-length'))) {
    return NextResponse.json({ error: 'CSV files must be 1 MB or smaller.' }, { status: 413 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let objects: Record<string, string>[]
  try {
    objects = await parseFile(file)
  } catch (error) {
    if (error instanceof ImportCsvError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Unable to read the CSV file. Check its format and try again.' }, { status: 400 })
  }

  if (objects.length === 0) return NextResponse.json({ error: 'File has no data rows' }, { status: 400 })

  const states = [...new Set(objects.map(o => (o.state ?? '').toUpperCase()))]
  const jurisdictions = await db.jurisdiction.findMany({
    where: { state: { in: states } },
    select: { id: true, state: true, county: true },
  })
  const jurMap = new Map(jurisdictions.map(j => [`${j.state}::${j.county.toLowerCase()}`, j.id]))

  // Validate rows
  const rows: ImportRow[] = objects.map((obj, i) => {
    const rowNum = i + 2

    // Status check before schema parse
    const rawStatus = (obj.status ?? '').trim().toUpperCase()
    if (rawStatus && !IMPORTABLE_STATUSES.includes(rawStatus as ImportStatus)) {
      return { rowNum, raw: obj, valid: false, errors: [`status: Invalid value "${obj.status}". ${STATUS_VALID_MSG}`] }
    }

    const parsed = RowSchema.safeParse(obj)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      return { rowNum, raw: obj, valid: false, errors }
    }

    const data = parsed.data
    const jurKey = `${data.state}::${data.county.toLowerCase()}`
    if (!jurMap.get(jurKey)) {
      return { rowNum, raw: obj, valid: false, errors: [`Jurisdiction not found: ${data.county}, ${data.state}`] }
    }

    const effectiveStatus = resolveStatus(obj, data)
    const statusErrors = validateStatusFields(effectiveStatus, data)
    if (statusErrors.length > 0) {
      return { rowNum, raw: obj, valid: false, errors: statusErrors }
    }

    return { rowNum, raw: obj, valid: true, errors: [], data: { ...data, effectiveStatus } }
  })

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      userId: synced.user.id,
      requestId: requestIdFromHeaders(req.headers),
      action: IMPORT_REQUEST_ACTION,
      meta: {
        mode: preview ? 'preview' : 'import',
        totalRows: rows.length,
        validRows: rows.filter(row => row.valid).length,
      },
    },
  })

  if (preview) {
    return NextResponse.json({ rows, total: rows.length, valid: rows.filter(r => r.valid).length })
  }

  // Import phase
  const validRows = rows.filter(r => r.valid && r.data)
  let imported = 0
  const importErrors: { rowNum: number; error: string; raw: Record<string, string> }[] = []

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
          status: dealStatusMap[d.effectiveStatus],
          notes: d.notes || null,
          taxLien: {
            create: {
              ...(d.certificate_number ? { certificateNumber: d.certificate_number } : {}),
              ...(d.face_amount != null ? {
                faceAmount:   d.face_amount,
                interestRate: d.interest_rate! / 100,
                issueDate:    new Date(`${d.issue_date}T12:00:00.000Z`),
              } : {}),
            },
          },
        },
      })

      if (d.effectiveStatus === 'ACTIVE') {
        await generateEventsForDeal(deal.id, tenant.id)
      }

      imported++
    } catch (err) {
      importErrors.push({ rowNum: row.rowNum, error: err instanceof Error ? err.message : 'Unknown error', raw: row.raw })
    }
  }

  return NextResponse.json({ imported, skipped: importErrors.length, errors: importErrors })
}
