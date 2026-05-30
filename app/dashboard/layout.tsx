import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      {/* Top nav */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-base font-semibold tracking-tight text-zinc-900">Metis</span>
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/liens"
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Liens
            </Link>
            <Link
              href="/dashboard/calendar"
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Calendar
            </Link>
            <Link
              href="/dashboard/tasks"
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Tasks
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
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            afterCreateOrganizationUrl="/dashboard"
          />
          <UserButton />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
