import {
  costBasis,
  incomeToDate,
  realizedPnl,
  accruedLienInterest,
  unrealizedLienValue,
  annualizedReturn,
  type LedgerRow,
} from '@/lib/economics'
import { TRANSACTION_DIRECTION } from '@/lib/transactions'

export interface PnlCardTx {
  type: LedgerRow['type']
  amount: number
  date: Date
}

export interface PnlCardLien {
  faceAmount: number
  annualRate: number  // decimal fraction, e.g. 0.18 = 18%
  issueDate: Date
  isRedeemed: boolean
}

// Statuses that indicate the deal has exited (income has been realized)
const EXITED_STATUSES = new Set(['REDEEMED', 'SOLD', 'CLOSED'])

interface Props {
  transactions: PnlCardTx[]
  dealStatus: string
  strategyType: string
  lien?: PnlCardLien | null
}

export default function DealPnlCard({ transactions, dealStatus, strategyType, lien }: Props) {
  const rows: LedgerRow[] = transactions.map(t => ({ type: t.type, amount: t.amount, date: t.date }))
  const basis  = costBasis(rows)
  const income = incomeToDate(rows)
  const pnl    = realizedPnl(rows)

  const isActiveLien = strategyType === 'TAX_LIEN' && lien && !lien.isRedeemed
  const isExited     = EXITED_STATUSES.has(dealStatus)

  // Accrued interest for active (unredeemed) tax liens
  const now = new Date()
  const accrued = isActiveLien
    ? accruedLienInterest({ faceAmount: lien.faceAmount, annualRate: lien.annualRate, issueDate: lien.issueDate, asOf: now })
    : null
  const estValue = isActiveLien
    ? unrealizedLienValue({ faceAmount: lien.faceAmount, annualRate: lien.annualRate, issueDate: lien.issueDate, asOf: now })
    : null

  // Annualized return for exited deals.
  // Start date = earliest OUT transaction (first purchase/expense).
  // End date   = latest IN transaction (last income received).
  // Rationale: captures full investment horizon from first dollar out to last dollar in.
  let annReturn: number | null = null
  if (isExited && income > 0 && basis > 0) {
    const outRows = rows.filter(r => TRANSACTION_DIRECTION[r.type] === 'OUT')
    const inRows  = rows.filter(r => TRANSACTION_DIRECTION[r.type] === 'IN')
    if (outRows.length > 0 && inRows.length > 0) {
      const startDate = new Date(Math.min(...outRows.map(r => r.date.getTime())))
      const endDate   = new Date(Math.max(...inRows.map(r => r.date.getTime())))
      annReturn = annualizedReturn({ invested: basis, returned: income, startDate, endDate })
    }
  }

  // Hide card when no transactions AND no lien accrual to compute
  if (rows.length === 0 && !isActiveLien) return null

  const fmt = (n: number) =>
    '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const pnlColor      = pnl > 0 ? 'text-green-700' : pnl < 0 ? 'text-red-700' : 'text-zinc-900'
  const annRetColor   = annReturn !== null && annReturn > 0 ? 'text-green-700' : annReturn !== null && annReturn < 0 ? 'text-red-700' : 'text-zinc-900'

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <h2 className="text-sm font-semibold text-zinc-900 mb-4">P&L Summary</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">Cost Basis</dt>
          <dd className="text-zinc-900 font-medium">{fmt(basis)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Income</dt>
          <dd className="text-zinc-900 font-medium">{fmt(income)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-100 pt-2">
          <dt className="text-zinc-500">Realized P&L</dt>
          <dd className={`font-semibold ${pnlColor}`}>
            {pnl >= 0 ? '+' : '-'}{fmt(pnl)}
          </dd>
        </div>
        {accrued !== null && (
          <>
            <div className="flex justify-between">
              <dt className="text-zinc-400 text-xs">Accrued Interest (est.)</dt>
              <dd className="text-zinc-600 text-xs font-medium">{fmt(accrued)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400 text-xs">Est. Value</dt>
              <dd className="text-zinc-600 text-xs font-medium">{fmt(estValue!)}</dd>
            </div>
          </>
        )}
        {annReturn !== null && (
          <div className="flex justify-between border-t border-zinc-100 pt-2">
            <dt className="text-zinc-500">Annualized Return</dt>
            <dd className={`font-semibold ${annRetColor}`}>
              {annReturn >= 0 ? '+' : ''}{(annReturn * 100).toFixed(1)}%
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
