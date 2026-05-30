import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const PLAN_PRICES: Record<string, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER ?? '',
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
  TEAM: process.env.STRIPE_PRICE_TEAM ?? '',
}

export const PLAN_LIMITS = {
  STARTER: { maxUsers: 1, maxDeals: 10, aiIncluded: false },
  PROFESSIONAL: { maxUsers: 3, maxDeals: Infinity, aiIncluded: true },
  TEAM: { maxUsers: 10, maxDeals: Infinity, aiIncluded: true },
  ENTERPRISE: { maxUsers: Infinity, maxDeals: Infinity, aiIncluded: true },
} as const

export type PlanKey = keyof typeof PLAN_LIMITS
