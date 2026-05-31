import Stripe from 'stripe'

// Lazy singleton — avoids throwing at import time when STRIPE_SECRET_KEY
// is not set (e.g. during Next.js build on Vercel before env vars are loaded).
let _stripe: Stripe | null = null
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
    })
  }
  return _stripe
}

export const PLAN_PRICES: Record<string, string> = {
  STARTER:      process.env.STRIPE_PRICE_STARTER      ?? '',
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
  TEAM:         process.env.STRIPE_PRICE_TEAM         ?? '',
}

export const PLAN_LIMITS = {
  STARTER:      { maxUsers: 1,        maxDeals: 10,       aiIncluded: false },
  PROFESSIONAL: { maxUsers: 3,        maxDeals: Infinity, aiIncluded: true  },
  TEAM:         { maxUsers: 10,       maxDeals: Infinity, aiIncluded: true  },
  ENTERPRISE:   { maxUsers: Infinity, maxDeals: Infinity, aiIncluded: true  },
} as const

export type PlanKey = keyof typeof PLAN_LIMITS
