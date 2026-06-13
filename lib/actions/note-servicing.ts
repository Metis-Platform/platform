'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'
import { payoffQuote } from '@/lib/land-note-servicing'
import { getResend } from '@/lib/email'

export type NoteServicingState = { error?: string; success?: string }

const NOTICE_LABELS: Record<string, string> = {
  REMINDER:        'Payment Reminder',
  LATE:            'Late Payment Notice',
  DEFAULT_WARNING: 'Default Warning',
}

export async function sendLateNotice(
  dealId: string,
  noteId: string,
  noticeType: 'REMINDER' | 'LATE' | 'DEFAULT_WARNING',
): Promise<NoteServicingState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  if (!await hasTier(tenant.id, 'LAND', 'PREMIUM')) {
    return { error: 'Note servicing automation requires Land PREMIUM tier.' }
  }

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    include: { property: true },
  })
  if (!deal) return { error: 'Deal not found' }

  const note = await db.landNote.findUnique({ where: { id: noteId, dealId } })
  if (!note) return { error: 'Note not found' }
  if (!note.buyerEmail) return { error: 'No buyer email on record for this note.' }

  const label = NOTICE_LABELS[noticeType] ?? 'Notice'
  const subject = `${label} — ${deal.property.apn}`

  const html = buildNoticeHtml({
    noticeType,
    apn: deal.property.apn,
    buyerName: note.buyerName ?? 'Borrower',
    balance: Number(note.balance),
    paymentAmount: Number(note.paymentAmount),
  })

  await getResend().emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com',
    to:   [note.buyerEmail],
    subject,
    html,
  })

  // Log the notice as a task note on the deal
  await db.task.create({
    data: {
      tenantId: tenant.id,
      dealId,
      taskType: 'SEND_NOTICE',
      title:    `${label} sent to ${note.buyerEmail}`,
      status:   'COMPLETED',
      priority: 'MEDIUM',
    },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return { success: `${label} sent to ${note.buyerEmail}` }
}

export async function computePayoffQuote(
  dealId: string,
  noteId: string,
  asOfDateStr: string,
  honorDays = 10,
): Promise<{ error?: string; quote?: ReturnType<typeof payoffQuote> }> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  if (!await hasTier(tenant.id, 'LAND', 'PREMIUM')) {
    return { error: 'Payoff quotes require Land PREMIUM tier.' }
  }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id }, select: { id: true } })
  if (!deal) return { error: 'Deal not found' }

  const note = await db.landNote.findUnique({ where: { id: noteId, dealId } })
  if (!note) return { error: 'Note not found' }

  const asOfDate = new Date(asOfDateStr)
  if (isNaN(asOfDate.getTime())) return { error: 'Invalid date' }

  const quote = payoffQuote(
    {
      principal:        Number(note.principal),
      interestRate:     Number(note.interestRate),
      termMonths:       note.termMonths,
      paymentAmount:    Number(note.paymentAmount),
      firstPaymentDate: note.firstPaymentDate,
      balance:          Number(note.balance),
    },
    asOfDate,
    honorDays,
  )

  return { quote }
}

// ---------------------------------------------------------------------------
// Email HTML
// ---------------------------------------------------------------------------

function buildNoticeHtml({
  noticeType, apn, buyerName, balance, paymentAmount,
}: {
  noticeType: string
  apn: string
  buyerName: string
  balance: number
  paymentAmount: number
}) {
  const urgency = {
    REMINDER:        { color: '#0284c7', title: 'Payment Reminder', message: 'Your payment is past due. Please remit payment at your earliest convenience.' },
    LATE:            { color: '#d97706', title: 'Late Payment Notice', message: 'Your payment is now late. A late fee may apply. Please contact us to resolve your account.' },
    DEFAULT_WARNING: { color: '#dc2626', title: 'Default Warning', message: 'Your account is at risk of default. Please contact us immediately to discuss your options.' },
  }[noticeType] ?? { color: '#374151', title: 'Notice', message: 'Please review your account.' }

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid ${urgency.color};padding-left:16px;margin-bottom:24px">
    <h2 style="color:${urgency.color};margin:0 0 4px">${urgency.title}</h2>
    <p style="margin:0;color:#6b7280;font-size:14px">Property: ${apn}</p>
  </div>
  <p>Dear ${buyerName},</p>
  <p>${urgency.message}</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f9fafb">
      <td style="padding:8px 12px;font-size:14px;color:#6b7280">Outstanding Balance</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:bold">$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280">Monthly Payment</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:bold">$${paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    </tr>
  </table>
  <p style="font-size:12px;color:#9ca3af">Metis Platform · metisplatforms.com</p>
</body>
</html>`
}
