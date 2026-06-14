import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'
import { auth } from '@clerk/nextjs/server'
import { StrategyType, Prisma } from '@/app/generated/prisma'

const putSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
  data: z.record(z.string(), z.unknown()),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const rows = await db.jurisdictionStrategyData.findMany({ where: { jurisdictionId: id } })
  return NextResponse.json(rows)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { userId } = await auth()

  const body = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const jsonData = parsed.data.data as Prisma.InputJsonValue
  const row = await db.jurisdictionStrategyData.upsert({
    where: { jurisdictionId_strategy: { jurisdictionId: id, strategy: parsed.data.strategy } },
    update: { data: jsonData, updatedBy: userId ?? null },
    create: { jurisdictionId: id, strategy: parsed.data.strategy, data: jsonData, updatedBy: userId ?? null },
  })
  return NextResponse.json(row)
}
