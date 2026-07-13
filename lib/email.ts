import { Resend } from 'resend'
import { resolveEmailDeliveryPolicy, type RuntimeEnvironment } from './side-effect-policy'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

type EmailOptions = Parameters<Resend['emails']['send']>[0]
export type EmailDeliveryResult = 'sent' | 'sunk'

function addresses(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export async function sendEmail(
  options: EmailOptions,
  env: RuntimeEnvironment = process.env
): Promise<EmailDeliveryResult> {
  const recipients = [
    ...addresses(options.to),
    ...addresses(options.cc),
    ...addresses(options.bcc),
  ]
  const policy = resolveEmailDeliveryPolicy(recipients, env)
  if (policy === 'sink') return 'sunk'

  const response = await getResend().emails.send(options)
  if (response.error) throw new Error('Email delivery failed')
  return 'sent'
}

export type AlertEvent = {
  label: string
  dueDate: Date
  apn: string
  county: string
  state: string
  dealId: string
}

/** Build and send the daily digest email for one tenant. */
export async function sendDailyDigest({
  to,
  tenantName,
  overdue,
  dueSoon,       // within 7 days
  upcoming,      // 8–30 days
  appUrl,
}: {
  to: string[]
  tenantName: string
  overdue: AlertEvent[]
  dueSoon: AlertEvent[]
  upcoming: AlertEvent[]
  appUrl: string
}): Promise<EmailDeliveryResult | 'skipped'> {
  if (to.length === 0) return 'skipped'

  const total = overdue.length + dueSoon.length + upcoming.length
  if (total === 0) return 'skipped'  // nothing to report — skip the email

  const subject =
    overdue.length > 0
      ? `🚨 ${overdue.length} overdue lien${overdue.length !== 1 ? 's' : ''} — Metis Daily Digest`
      : dueSoon.length > 0
      ? `⚠️ ${dueSoon.length} deadline${dueSoon.length !== 1 ? 's' : ''} due within 7 days — Metis`
      : `📅 ${upcoming.length} upcoming deadline${upcoming.length !== 1 ? 's' : ''} — Metis`

  const html = buildDigestHtml({ tenantName, overdue, dueSoon, upcoming, appUrl })

  return sendEmail({
    from: process.env.EMAIL_FROM ?? 'noreply@metisplatform.com',
    to,
    subject,
    html,
  })
}

// ---------------------------------------------------------------------------
// HTML builder — intentionally simple inline-styles for email client compat
// ---------------------------------------------------------------------------

function buildDigestHtml({
  tenantName,
  overdue,
  dueSoon,
  upcoming,
  appUrl,
}: {
  tenantName: string
  overdue: AlertEvent[]
  dueSoon: AlertEvent[]
  upcoming: AlertEvent[]
  appUrl: string
}): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const daysAgo = (d: Date) => Math.abs(Math.round((d.getTime() - Date.now()) / 86_400_000))
  const daysUntil = (d: Date) => Math.round((d.getTime() - Date.now()) / 86_400_000)

  function eventRows(events: AlertEvent[], color: string, badge: (e: AlertEvent) => string) {
    return events.map(e => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
          <a href="${appUrl}/dashboard/deals/${e.dealId}"
             style="font-family:monospace;font-size:13px;color:#2563eb;text-decoration:none;">
            ${e.apn}
          </a>
          <span style="font-size:12px;color:#64748b;margin-left:6px;">${e.county}, ${e.state}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;">
          ${e.label}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;white-space:nowrap;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color};color:#fff;font-weight:600;">
            ${badge(e)}
          </span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">
          ${fmt(e.dueDate)}
        </td>
      </tr>`).join('')
  }

  function section(title: string, icon: string, borderColor: string, events: AlertEvent[], color: string, badge: (e: AlertEvent) => string) {
    if (events.length === 0) return ''
    return `
      <div style="margin-bottom:24px;">
        <div style="padding:10px 16px;background:#f8fafc;border-left:3px solid ${borderColor};border-radius:4px;margin-bottom:8px;">
          <span style="font-size:14px;font-weight:600;color:#1e293b;">${icon} ${title} (${events.length})</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">APN / Parcel</th>
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Deadline</th>
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Status</th>
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Due Date</th>
            </tr>
          </thead>
          <tbody>${eventRows(events, color, badge)}</tbody>
        </table>
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1e293b;padding:20px 24px;display:flex;align-items:center;">
      <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-.5px;">Metis</span>
      <span style="margin-left:8px;font-size:12px;color:#94a3b8;">Daily Digest</span>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <p style="font-size:14px;color:#64748b;margin:0 0 20px;">
        Good morning, <strong style="color:#1e293b;">${tenantName}</strong> — here's your lien portfolio summary for today.
      </p>

      ${section('Overdue', '🚨', '#ef4444', overdue, '#ef4444', e => `${daysAgo(e.dueDate)}d overdue`)}
      ${section('Due within 7 days', '⚠️', '#f59e0b', dueSoon, '#f59e0b', e => `${daysUntil(e.dueDate)}d remaining`)}
      ${section('Due in 8–30 days', '📅', '#3b82f6', upcoming, '#3b82f6', e => `${daysUntil(e.dueDate)}d remaining`)}

      <div style="text-align:center;margin-top:24px;">
        <a href="${appUrl}/dashboard"
           style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
          Open Dashboard →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;border-top:1px solid #f1f5f9;background:#f8fafc;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">
        You're receiving this because you have an active Metis account.
        Manage your notification preferences in your
        <a href="${appUrl}/dashboard" style="color:#2563eb;">account settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`
}
