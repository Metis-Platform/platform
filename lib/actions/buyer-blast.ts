'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'
import { getResend } from '@/lib/email'

export type BuyerBlastState = {
  error?: string
  success?: string
  sent?: number
  skipped?: number
}

export async function sendBuyerBlast(dealId: string): Promise<BuyerBlastState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  if (!await hasTier(tenant.id, 'WHOLESALE', 'PREMIUM')) {
    return { error: 'Buyer blast requires Wholesale PREMIUM tier.' }
  }

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    include: {
      property: { select: { apn: true, address: true, city: true, state: true, zip: true, acres: true, assessedValue: true } },
      wholesale: { select: { contractPrice: true, assignmentFee: true, closingDeadline: true, dispositionStatus: true, marketingNotes: true } },
    },
  })
  if (!deal) return { error: 'Deal not found' }
  if (deal.strategyType !== 'WHOLESALE') return { error: 'Not a wholesale deal' }

  // Find buy-box-matched buyers (state match + price range)
  const dealState = deal.property.state ?? null
  const contractPriceNum = deal.wholesale?.contractPrice != null ? Number(deal.wholesale.contractPrice) : null

  const buyers = await db.contact.findMany({
    where: {
      tenantId: tenant.id,
      type: 'BUYER',
      buyerProfile: {
        isActive: true,
        ...(dealState ? { preferredStates: { has: dealState } } : {}),
      },
      email: { not: null },
    },
    include: { buyerProfile: true },
  })

  // Filter by price range
  const eligible = buyers.filter(b => {
    if (!contractPriceNum) return true
    const { priceMin, priceMax } = b.buyerProfile ?? {}
    if (priceMin && contractPriceNum < Number(priceMin)) return false
    if (priceMax && contractPriceNum > Number(priceMax)) return false
    return true
  })

  if (eligible.length === 0) {
    return { success: 'No matched buyers with email addresses.', sent: 0, skipped: 0 }
  }

  // Find already-sent contacts for this deal
  const alreadySent = await db.buyerBlastSend.findMany({
    where: { dealId, tenantId: tenant.id },
    select: { contactId: true },
  })
  const sentContactIds = new Set(alreadySent.map(s => s.contactId))

  const toSend = eligible.filter(b => !sentContactIds.has(b.id))
  const skipped = eligible.length - toSend.length

  if (toSend.length === 0) {
    return { success: `All ${eligible.length} matched buyers already received this blast.`, sent: 0, skipped }
  }

  const resend = getResend()
  const dealSheetHtml = buildDealSheetHtml(deal)

  let sent = 0
  const errors: string[] = []

  for (const buyer of toSend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com',
        to:   [buyer.email!],
        subject: `New Wholesale Deal — ${deal.property.apn}${deal.property.city ? ` (${deal.property.city}, ${deal.property.state})` : ''}`,
        html: dealSheetHtml,
      })
      await db.buyerBlastSend.create({
        data: { tenantId: tenant.id, dealId, contactId: buyer.id },
      })
      sent++
    } catch {
      errors.push(buyer.email!)
    }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)

  if (errors.length > 0) {
    return { error: `Sent ${sent}, failed for: ${errors.join(', ')}`, sent, skipped }
  }
  return { success: `Blast sent to ${sent} buyer${sent === 1 ? '' : 's'}.`, sent, skipped }
}

// ---------------------------------------------------------------------------
// Deal sheet HTML
// ---------------------------------------------------------------------------

function buildDealSheetHtml(deal: {
  id: string
  purchasePrice: { toString(): string } | null
  property: {
    apn: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    acres: { toString(): string } | null
    assessedValue: { toString(): string } | null
  }
  wholesale: {
    contractPrice: { toString(): string } | null
    assignmentFee: { toString(): string } | null
    closingDeadline: Date | null
    marketingNotes: string | null
  } | null
}) {
  const { property, wholesale } = deal
  const address = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')
  const contractPrice = wholesale?.contractPrice ? `$${Number(wholesale.contractPrice).toLocaleString()}` : 'TBD'
  const assignmentFee = wholesale?.assignmentFee ? `$${Number(wholesale.assignmentFee).toLocaleString()}` : 'TBD'
  const closeBy = wholesale?.closingDeadline
    ? new Date(wholesale.closingDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'TBD'

  const rows = [
    ['APN', property.apn],
    ['Address', address || '—'],
    ['Acres', property.acres ? `${Number(property.acres).toFixed(2)} ac` : '—'],
    ['Assessed Value', property.assessedValue ? `$${Number(property.assessedValue).toLocaleString()}` : '—'],
    ['Contract Price', contractPrice],
    ['Assignment Fee', assignmentFee],
    ['Close By', closeBy],
  ]

  const rowsHtml = rows.map(([k, v]) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:13px;color:#6b7280;width:160px">${k}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111">${v}</td>
    </tr>`).join('')

  const notes = wholesale?.marketingNotes
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:6px;font-size:13px;color:#374151">${wholesale.marketingNotes}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;max-width:540px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid #7c3aed;padding-left:16px;margin-bottom:20px">
    <h2 style="margin:0 0 4px;color:#7c3aed;font-size:18px">Wholesale Deal Available</h2>
    <p style="margin:0;color:#6b7280;font-size:13px">${address || property.apn}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    ${rowsHtml}
  </table>
  ${notes}
  <p style="margin-top:20px;font-size:12px;color:#9ca3af">
    Reply to this email to express interest or ask questions.<br>
    Metis Platform · metisplatforms.com
  </p>
</body>
</html>`
}
