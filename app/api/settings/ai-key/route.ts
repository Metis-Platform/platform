import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'

const Body = z.object({
  apiKey: z.string().min(1).nullable(),
})

export async function PATCH(req: Request) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'OWNER')) {
    return NextResponse.json({ error: 'Only owners can manage the AI key' }, { status: 403 })
  }

  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  await db.$transaction(async tx => {
    await tx.tenant.update({
      where: { id: result.tenant.id },
      data: { anthropicApiKey: parsed.data.apiKey },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'AI_KEY_CONFIGURATION_CHANGED',
        // The ledger records the state change, never the credential or request body.
        meta: { configured: parsed.data.apiKey !== null },
      },
    })
  })

  return NextResponse.json({ ok: true })
}
