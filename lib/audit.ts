import { db } from '@/lib/db'
import { Prisma } from '@/app/generated/prisma'

type AuditAction =
  | 'DEAL_CREATED'
  | 'DEAL_ARCHIVED'
  | 'BLAST_SENT'
  | 'NOTE_PAYMENT_LOGGED'
  | 'CHECKLIST_CREATED'
  | 'LOGIN'
  | 'ADMIN_EMAIL_SENT'

export async function emitAuditEvent(
  tenantId: string,
  action: AuditAction,
  meta?: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action,
        meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch {
    // Audit failures must never block the calling operation
  }
}
