import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { requestIdFromHeaders } from '@/lib/request-correlation'

const schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'OWNER')) {
    return NextResponse.json({ error: 'Only owners can invite team members' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const client = await clerkClient()
  await client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: parsed.data.email,
    role: 'org:member',
    inviterUserId: result.user.clerkUserId,
  })

  await db.auditEvent.create({
    data: {
      tenantId: result.tenant.id,
      userId: result.user.id,
      requestId: requestIdFromHeaders(req.headers),
      action: 'TEAM_MEMBER_INVITED',
      // Do not retain the invitee's email address in the audit ledger.
      meta: { organizationId: orgId },
    },
  })

  return NextResponse.json({ ok: true })
}
