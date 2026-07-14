import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import JurisdictionResearchWorkControls from './JurisdictionResearchWorkControls'

export const dynamic = 'force-dynamic'

export default async function JurisdictionResearchPage() {
  if (!(await isSuperAdmin())) redirect('/')
  const work = await db.jurisdictionResearchWork.findMany({
    include: {
      jurisdiction: {
        select: {
          county: true,
          state: true,
          _count: {
            select: {
              researchDemands: true,
              sourceUrls: true,
              extractionCandidates: { where: { status: 'PENDING' } },
            },
          },
        },
      },
    },
    orderBy: { requestedAt: 'asc' },
    take: 200,
  })
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">County Research Work</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Shared execution only. Coverage remains derived from evidence-backed claims, not this queue.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">County</th>
              <th className="px-4 py-3">Execution</th>
              <th className="px-4 py-3">Demand</th>
              <th className="px-4 py-3">Sources</th>
              <th className="px-4 py-3">Candidates</th>
              <th className="px-4 py-3">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {work.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <Link className="font-medium text-blue-700 hover:underline" href={`/admin/rules/${row.jurisdictionId}`}>
                    {row.jurisdiction.county}, {row.jurisdiction.state}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {row.status === 'PAUSED' ? `Paused: ${row.pausedReason}` : 'Discovering sources'}
                </td>
                <td className="px-4 py-3">{row.jurisdiction._count.researchDemands}</td>
                <td className="px-4 py-3">{row.jurisdiction._count.sourceUrls}</td>
                <td className="px-4 py-3">{row.jurisdiction._count.extractionCandidates}</td>
                <td className="px-4 py-3">
                  <JurisdictionResearchWorkControls workId={row.id} status={row.status} />
                </td>
              </tr>
            ))}
            {work.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                  No county research work has been requested.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
