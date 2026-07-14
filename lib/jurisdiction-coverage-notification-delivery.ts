import { db } from './db'
import { sendEmail, type EmailDeliveryResult } from './email'

export type CoverageNotificationDelivery = 'sent' | 'sunk' | 'skipped' | 'failed'

function notificationHtml(input: { county: string; state: string; appUrl: string; jurisdictionId: string }) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
    <p>Metis now has reviewed, current jurisdiction coverage for <strong>${input.county} County, ${input.state}</strong>.</p>
    <p>This notice means the county coverage is evidence-backed at the time of review. You should still evaluate each parcel and confirm time-sensitive facts before investing.</p>
    <p><a href="${input.appUrl}/dashboard/jurisdictions/${input.jurisdictionId}">Open the county research hub</a></p>
  </div>`
}

export async function deliverPendingCoverageNotifications(limit = 100): Promise<Record<CoverageNotificationDelivery, number>> {
  const pending = await db.jurisdictionCoverageNotification.findMany({
    where: { status: 'PENDING', recipientEmail: { not: null } },
    include: { jurisdiction: { select: { county: true, state: true } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const result: Record<CoverageNotificationDelivery, number> = { sent: 0, sunk: 0, skipped: 0, failed: 0 }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://metisplatforms.com'
  const from = process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com'

  for (const notification of pending) {
    const claimed = await db.jurisdictionCoverageNotification.updateMany({
      where: { id: notification.id, status: 'PENDING' },
      data: { attemptedAt: new Date(), failureCode: null },
    })
    if (claimed.count !== 1) {
      result.skipped += 1
      continue
    }
    try {
      const delivery: EmailDeliveryResult = await sendEmail({
        from,
        to: notification.recipientEmail!,
        subject: `County research is ready: ${notification.jurisdiction.county} County, ${notification.jurisdiction.state}`,
        html: notificationHtml({ ...notification.jurisdiction, appUrl, jurisdictionId: notification.jurisdictionId }),
        idempotencyKey: `jurisdiction-coverage-${notification.id}`,
      })
      await db.jurisdictionCoverageNotification.updateMany({
        where: { id: notification.id, status: 'PENDING' },
        data: { status: delivery === 'sent' ? 'SENT' : 'SUNK', deliveredAt: new Date() },
      })
      await db.jurisdictionResearchDemand.updateMany({
        where: { id: notification.demandId, tenantId: notification.tenantId, notifiedAt: null },
        data: { notifiedAt: new Date() },
      })
      result[delivery] += 1
    } catch {
      await db.jurisdictionCoverageNotification.updateMany({
        where: { id: notification.id, status: 'PENDING' },
        data: { failureCode: 'DELIVERY_FAILED' },
      })
      result.failed += 1
    }
  }
  return result
}
