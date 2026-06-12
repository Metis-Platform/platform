import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'

const TRANSACTION_TYPES = [
  'PURCHASE', 'SUBSEQUENT_TAX', 'LEGAL_FEE', 'TITLE_SEARCH', 'RECORDING_FEE',
  'REDEMPTION_RECEIVED', 'OTHER_INCOME', 'OTHER_EXPENSE',
  'SALE_PROCEEDS', 'RENT_RECEIVED', 'NOTE_PAYMENT_RECEIVED',
  'REHAB_COST', 'INSURANCE', 'PROPERTY_TAX', 'HOA_FEE', 'MANAGEMENT_FEE', 'LOAN_PAYMENT',
] as const

const PostSchema = z.object({
  type:        z.enum(TRANSACTION_TYPES),
  amount:      z.number().positive(),
  date:        z.string().min(1),
  description: z.string().max(500).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced

  const { id: dealId } = await params

  const deal = await db.deal.findUnique({ where: { id: dealId } })
  if (!deal || deal.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  const transactions = await db.financialTransaction.findMany({
    where: { dealId, tenantId: tenant.id },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ANALYST')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { tenant } = result

  const { id: dealId } = await params

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const deal = await db.deal.findUnique({ where: { id: dealId } })
  if (!deal || deal.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  const tx = await db.financialTransaction.create({
    data: {
      dealId,
      tenantId: tenant.id,
      type: parsed.data.type,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      description: parsed.data.description ?? null,
    },
  })

  return NextResponse.json(tx, { status: 201 })
}
