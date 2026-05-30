import { isSuperAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSuperAdmin())) redirect('/')

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-base font-semibold tracking-tight text-white">Metis Admin</span>
          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className="px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-md transition-colors"
            >
              Tenants
            </Link>
          </nav>
        </div>
        <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-white transition-colors">
          ← Back to app
        </Link>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
