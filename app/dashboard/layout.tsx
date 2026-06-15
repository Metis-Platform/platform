import { Suspense } from 'react'
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import StrategyNav, { DealsNavLink } from './StrategyNav'
import { isSuperAdmin } from '@/lib/admin-auth'
import { getEnabledStrategies } from '@/lib/entitlements'
import { db } from '@/lib/db'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [superAdmin, { orgId }] = await Promise.all([isSuperAdmin(), auth()])

  let enabledKeys: string[] = []
  if (orgId) {
    const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
    if (tenant) enabledKeys = await getEnabledStrategies(tenant.id)
  }

  const now = new Date()
  const announcements = await db.announcement.findMany({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      {/* Announcement banners */}
      {announcements.map(a => (
        <div
          key={a.id}
          className={`w-full px-6 py-2 text-sm text-center font-medium ${
            a.severity === 'WARNING'
              ? 'bg-amber-400 text-amber-900'
              : 'bg-blue-600 text-white'
          }`}
        >
          {a.message}
        </div>
      ))}
      {/* Top nav */}
      <header className="border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold tracking-tight text-zinc-900">Metis</span>
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Dashboard
              </Link>
              <Suspense fallback={
                <Link href="/dashboard/deals" className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                  Deals
                </Link>
              }>
                <DealsNavLink className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors" />
              </Suspense>
              <Link
                href="/dashboard/calendar"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Calendar
              </Link>
              <Link
                href="/dashboard/jurisdictions"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Jurisdictions
              </Link>
              <Link
                href="/dashboard/tasks"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Tasks
              </Link>
              <Link
                href="/dashboard/contacts"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Contacts
              </Link>
              <Link
                href="/dashboard/notes"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Notes
              </Link>
              <Link
                href="/dashboard/analytics"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/dashboard/copilot"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Copilot
              </Link>
              <Link
                href="/dashboard/billing"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Billing
              </Link>
              <Link
                href="/dashboard/settings/team"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                Team
              </Link>
              <Link
                href="/dashboard/settings/ai"
                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              >
                AI
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {superAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors"
              >
                ⚙ Admin
              </Link>
            )}
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
            />
            <UserButton />
          </div>
        </div>
        {/* Strategy switcher — shown on deal-focused pages */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">Module:</span>
          <Suspense fallback={null}>
            <StrategyNav enabledKeys={enabledKeys} />
          </Suspense>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
