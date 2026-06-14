import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const Body = z.object({
  apiKey: z.string().min(1).nullable(),
})

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  await db.tenant.update({
    where: { id: tenant.id },
    data: { anthropicApiKey: parsed.data.apiKey },
  })

  return NextResponse.json({ ok: true })
}
