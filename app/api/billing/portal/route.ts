import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { syncUserToDatabase } from '@/lib/sync-user'

export async function POST() {
  const result = await syncUserToDatabase()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenant } = result
  if (!tenant.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await getStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  })

  return NextResponse.json({ url: session.url })
}
