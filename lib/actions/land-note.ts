'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { emitAuditEvent } from '@/lib/audit'

export type LandNoteFormState = { errors?: Record<string, string[]>; message?: string }

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const optStr = z.string().max(200).optional().or(z.literal('')).transform(v => v || null)

const CreateNoteSchema = z.object({
  buyerName:        optStr,
  buyerEmail:       z.string().email('Invalid email').optional().or(z.literal('')).transform(v => v || null),
  buyerPhone:       optStr,
  principal:        z.coerce.number().positive('Principal must be > 0'),
  interestRate:     z.coerce.number().min(0, 'Rate must be ≥ 0').max(100, 'Rate must be ≤ 100'),
  termMonths:       z.coerce.number().int().positive('Term must be a positive integer'),
  paymentAmount:    z.coerce.number().positive('Payment amount must be > 0'),
  firstPaymentDate: z.string().min(1, 'First payment date is required'),
  notes:            z.string().max(2000).optional(),
})

const RecordPaymentSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  amount: z.coerce.number().positive('Amount must be > 0'),
  date:   z.string().min(1, 'Payment date is required'),
})

// ---------------------------------------------------------------------------
// createLandNote
// ---------------------------------------------------------------------------

export async function createLandNote(
  dealId: string,
  _prev: LandNoteFormState,
  formData: FormData,
): Promise<LandNoteFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = CreateNoteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { message: 'Deal not found.' }

  const d = parsed.data
  const buyerContactId = (formData.get('buyerContactId') as string)?.trim() || null

  try {
    await db.landNote.create({
      data: {
        dealId,
        tenantId:        tenant.id,
        buyerContactId,
        buyerName:       d.buyerName ?? null,
        buyerEmail:      d.buyerEmail ?? null,
        buyerPhone:      d.buyerPhone ?? null,
        principal:       d.principal,
        interestRate:    d.interestRate / 100, // store as fraction
        termMonths:      d.termMonths,
        paymentAmount:   d.paymentAmount,
        firstPaymentDate: new Date(`${d.firstPaymentDate}T12:00:00.000Z`),
        balance:         d.principal, // starts at full principal
        notes:           d.notes || null,
      },
    })
  } catch (err) {
    console.error('[createLandNote]', err)
    return { message: 'Failed to create note. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

// ---------------------------------------------------------------------------
// recordPayment
// ---------------------------------------------------------------------------

export async function recordPayment(
  dealId: string,
  _prev: LandNoteFormState,
  formData: FormData,
): Promise<LandNoteFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = RecordPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const { noteId, amount, date } = parsed.data

  const note = await db.landNote.findUnique({ where: { id: noteId, tenantId: tenant.id } })
  if (!note) return { message: 'Note not found.' }
  if (note.status !== 'ACTIVE') return { message: 'Note is not active.' }

  const paymentDate = new Date(`${date}T12:00:00.000Z`)
  const balance = Number(note.balance)
  const monthlyRate = Number(note.interestRate) / 12
  const interestPortion = Number((balance * monthlyRate).toFixed(2))
  const principalPortion = Number(Math.min(amount - interestPortion, balance).toFixed(2))
  const newBalance = Number(Math.max(0, balance - principalPortion).toFixed(2))

  // Compute expected payment date based on existing payment count
  const paymentCount = await db.financialTransaction.count({
    where: { dealId, tenantId: tenant.id, type: 'NOTE_PAYMENT_RECEIVED' },
  })
  const expectedDate = new Date(note.firstPaymentDate.getTime() + paymentCount * 30 * 86_400_000)
  const isLate = paymentDate > expectedDate

  try {
    await db.$transaction(async (tx) => {
      await tx.financialTransaction.create({
        data: {
          dealId,
          tenantId: tenant.id,
          type:     'NOTE_PAYMENT_RECEIVED',
          amount,
          date:     paymentDate,
          description: `Note payment — principal $${principalPortion.toFixed(2)}, interest $${interestPortion.toFixed(2)}`,
        },
      })

      const newStatus = newBalance <= 0.01 ? 'PAID_OFF' : 'ACTIVE'
      await tx.landNote.update({
        where: { id: noteId },
        data: { balance: newBalance, status: newStatus },
      })

      if (isLate) {
        const event = await tx.event.create({
          data: {
            dealId,
            eventType:     'PAYMENT_LATE',
            label:         'Late note payment',
            dueDate:       expectedDate,
            status:        'COMPLETED',
            completedDate: paymentDate,
            notes: `Payment $${amount.toFixed(2)} received ${paymentDate.toLocaleDateString('en-US')} — expected by ${expectedDate.toLocaleDateString('en-US')}`,
          },
        })
        await tx.task.create({
          data: {
            dealId,
            tenantId:    tenant.id,
            taskType:    'FOLLOW_UP',
            title:       'Late note payment — follow up with buyer',
            description: `Payment received late. Expected: ${expectedDate.toLocaleDateString('en-US')}, Received: ${paymentDate.toLocaleDateString('en-US')}. Review terms with buyer.`,
            status:      'COMPLETED',
            priority:    'HIGH',
            eventId:     event.id,
            completedAt: paymentDate,
          },
        })
      }
    })
  } catch (err) {
    console.error('[recordPayment]', err)
    return { message: 'Failed to record payment. Please try again.' }
  }

  await emitAuditEvent(tenant.id, 'NOTE_PAYMENT_LOGGED', { dealId, noteId, amount }, userId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
