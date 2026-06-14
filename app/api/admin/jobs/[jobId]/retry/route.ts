import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobId } = await params

  try {
    await db.$executeRaw`
      UPDATE pgboss.job
      SET state = 'created',
          retrylimit = retrylimit + 1,
          retrycount = 0,
          startafter = now()
      WHERE id = ${jobId}::uuid
        AND state = 'failed'
    `
    return NextResponse.redirect(new URL('/admin/health', _req.url))
  } catch {
    return NextResponse.json({ error: 'Failed to retry job or job not found' }, { status: 404 })
  }
}
