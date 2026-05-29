import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Top nav */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-base font-semibold tracking-tight text-zinc-900">
            Metis
          </span>
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            afterCreateOrganizationUrl="/dashboard"
          />
        </div>
        <UserButton />
      </header>

      {/* Page content */}
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  )
}
