import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import CommsClient from './CommsClient'

export default async function CommsPage() {
  if (!(await isSuperAdmin())) redirect('/')

  const tenants = await db.tenant.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })

  const activeAnnouncements = await db.announcement.findMany({
    where: { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
          <span>/</span>
          <span className="text-zinc-700">Communications</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Communications Center</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Send support emails and manage in-app announcements.</p>
      </div>

      <CommsClient
        tenants={tenants}
        activeAnnouncements={activeAnnouncements.map(a => ({
          id: a.id,
          message: a.message,
          severity: a.severity,
          endsAt: a.endsAt.toISOString(),
        }))}
      />
    </div>
  )
}
