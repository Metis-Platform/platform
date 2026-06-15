import type { EvalContext } from '../types'
import { blockedByUniversal, lienProjection, missingData, result } from './helpers'

export function evaluateLienEarnInterest(ctx: EvalContext) {
  const universal = blockedByUniversal('LIEN_EARN_INTEREST', ctx)
  if (universal) return universal
  const missing = missingData('LIEN_EARN_INTEREST', ctx, ['lienFaceValue'])
  if (missing) return missing

  const conditions = ['Verify state interest rate and bidding premium versus certificate face value']
  if (ctx.parcel.irsLienPresent) conditions.push('IRS lien may affect foreclosure path; monitor redemption rights')

  return result('LIEN_EARN_INTEREST', ctx.parcel.irsLienPresent ? 'CONDITIONAL' : 'VIABLE', [], conditions, lienProjection(ctx, 24))
}

export function evaluateLienForecloseToDeed(ctx: EvalContext) {
  const universal = blockedByUniversal('LIEN_FORECLOSE_TO_DEED', ctx)
  if (universal) return universal
  const missing = missingData('LIEN_FORECLOSE_TO_DEED', ctx, ['lienFaceValue'])
  if (missing) return missing

  const conditions = ['Quiet title may be required; verify deed quality and title insurance path']
  let verdict: 'VIABLE' | 'CONDITIONAL' = 'VIABLE'
  if (ctx.parcel.irsLienPresent) {
    verdict = 'CONDITIONAL'
    conditions.push('IRS has 120-day right of redemption post-sale')
  }
  if ((ctx.jurisdiction.taxDeedRedemptionDays ?? 0) > 36 * 30) {
    verdict = 'CONDITIONAL'
    conditions.push('Long redemption window creates hold-time risk')
  }

  return result('LIEN_FORECLOSE_TO_DEED', verdict, [], conditions, lienProjection(ctx, 36))
}

export function evaluateLienAssignCertificate(ctx: EvalContext) {
  const universal = blockedByUniversal('LIEN_ASSIGN_CERTIFICATE', ctx)
  if (universal) return universal
  const missing = missingData('LIEN_ASSIGN_CERTIFICATE', ctx, ['lienFaceValue'])
  if (missing) return missing

  return result(
    'LIEN_ASSIGN_CERTIFICATE',
    'VIABLE',
    [],
    ['Confirm certificate assignment is allowed by state and county auction rules'],
    lienProjection(ctx, 12),
  )
}
