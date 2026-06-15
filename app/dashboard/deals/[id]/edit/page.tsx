import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EditLienForm, EditLandForm, EditWholesaleForm, EditFixFlipForm, EditBuyHoldForm, EditMultifamilyForm } from './form'

export default async function EditLienPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const [deal, jurisdictions] = await Promise.all([
    db.deal.findUnique({
      where: { id, tenantId: tenant.id },
      include: {
        property: { include: { jurisdiction: true } },
        taxLien: true,
        land: true,
        wholesale: true,
        fixFlip: { include: { contractorContact: true } },
        buyHold: { include: { tenantContact: true, propertyManagerContact: true } },
        multifamily: { include: { propertyManagerContact: true } },
      },
    }),
    db.jurisdiction.findMany({ orderBy: [{ stateName: 'asc' }, { county: 'asc' }] }),
  ])

  if (!deal) notFound()

  const isLand        = deal.strategyType === 'LAND'
  const isWholesale   = deal.strategyType === 'WHOLESALE'
  const isFixFlip     = deal.strategyType === 'FIX_FLIP'
  const isBuyHold     = deal.strategyType === 'BUY_HOLD'
  const isMultifamily = deal.strategyType === 'MULTIFAMILY'

  const title = isLand ? 'Edit Land Deal'
    : isWholesale ? 'Edit Wholesale Deal'
    : isFixFlip ? 'Edit Fix & Flip'
    : isBuyHold ? 'Edit Buy & Hold'
    : isMultifamily ? 'Edit Multifamily'
    : 'Edit Lien'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
          <Link href="/dashboard/deals" className="hover:text-zinc-900">Deals</Link>
          <span>/</span>
          <Link href={`/dashboard/deals/${deal.id}`} className="hover:text-zinc-900 font-mono">{deal.property.apn}</Link>
          <span>/</span>
          <span className="text-zinc-900">Edit</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        {!isLand && !isWholesale && !isFixFlip && !isBuyHold && !isMultifamily && (
          <p className="text-sm text-zinc-500 mt-0.5">
            Changing jurisdiction or APN creates a new property record — existing events will be regenerated.
          </p>
        )}
      </div>

      {isLand ? (
        <EditLandForm deal={deal} jurisdictions={jurisdictions} />
      ) : isWholesale ? (
        <EditWholesaleForm deal={deal} jurisdictions={jurisdictions} />
      ) : isFixFlip ? (
        <EditFixFlipForm deal={deal} />
      ) : isBuyHold ? (
        <EditBuyHoldForm deal={deal} />
      ) : isMultifamily ? (
        <EditMultifamilyForm deal={deal} />
      ) : (
        <EditLienForm deal={deal} jurisdictions={jurisdictions} />
      )}
    </div>
  )
}
