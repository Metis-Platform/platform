import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import type { ContactType, ContactPipelineStage } from '@/app/generated/prisma'

const CONTACT_TYPES: ContactType[] = ['OWNER','ATTORNEY','AGENT','LENDER','BUYER','SELLER','AGENCY','CONTRACTOR','TENANT','VENDOR','OTHER']
const PIPELINE_STAGES: ContactPipelineStage[] = ['LEAD','CONTACTED','NEGOTIATING','UNDER_CONTRACT','CLOSED','DEAD']

const createSchema = z.object({
  type: z.enum(['OWNER','ATTORNEY','AGENT','LENDER','BUYER','SELLER','AGENCY','CONTRACTOR','TENANT','VENDOR','OTHER']),
  pipelineStage: z.enum(['LEAD','CONTACTED','NEGOTIATING','UNDER_CONTRACT','CLOSED','DEAD']).optional(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zip: z.string().max(10).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).refine(d => d.firstName || d.lastName || d.company, { message: 'Name or company required' })

export async function GET(req: Request) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ContactType | null
  const stage = searchParams.get('stage') as ContactPipelineStage | null
  const q = searchParams.get('q')?.trim()

  const contacts = await db.contact.findMany({
    where: {
      tenantId: tenant.id,
      ...(type && CONTACT_TYPES.includes(type) ? { type } : {}),
      ...(stage && PIPELINE_STAGES.includes(stage) ? { pipelineStage: stage } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { deals: true, activities: true } },
      activities: { orderBy: { occurredAt: 'desc' }, take: 1 },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { company: 'asc' }],
  })

  return NextResponse.json({ contacts })
}

export async function POST(req: Request) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, pipelineStage, ...rest } = parsed.data
  const contact = await db.contact.create({
    data: { tenantId: tenant.id, type, pipelineStage: pipelineStage ?? 'LEAD', ...rest },
  })

  return NextResponse.json({ contact }, { status: 201 })
}
