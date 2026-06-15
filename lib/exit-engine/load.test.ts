import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dealFindFirstOrThrow: vi.fn(),
  parcelDataCacheFindMany: vi.fn(),
  fmrRateFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    deal: { findFirstOrThrow: mocks.dealFindFirstOrThrow },
    parcelDataCache: { findMany: mocks.parcelDataCacheFindMany },
    fmrRate: { findMany: mocks.fmrRateFindMany },
  },
}))

import { StrategyType } from '@/app/generated/prisma'
import { buildEvalContext } from './load'

describe('buildEvalContext', () => {
  it('assembles a tenant-scoped EvalContext from deal, parcel cache, jurisdiction facts, and investor constraints', async () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    mocks.dealFindFirstOrThrow.mockResolvedValue({
      id: 'deal_1',
      tenantId: 'tenant_1',
      propertyId: 'prop_1',
      contactId: null,
      strategyType: StrategyType.BUY_HOLD,
      status: 'ACTIVE',
      purchasePrice: 100000,
      purchaseDate: null,
      exitPrice: null,
      exitDate: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      property: {
        id: 'prop_1',
        tenantId: 'tenant_1',
        jurisdictionId: 'jur_1',
        apn: '12-34-56-7890',
        address: null,
        city: null,
        state: 'FL',
        zip: null,
        legalDescription: null,
        propertyType: null,
        acres: 0.25,
        sqft: 1200,
        beds: 3,
        baths: null,
        yearBuilt: null,
        assessedValue: 90000,
        createdAt: now,
        updatedAt: now,
        jurisdiction: {
          id: 'jur_1',
          state: 'FL',
          stateName: 'Florida',
          county: 'Orange',
          fips: '12095',
          timezone: 'America/New_York',
          investmentType: 'DEED',
          notes: null,
          links: null,
          isAvailable: true,
          createdAt: now,
          updatedAt: now,
          strategyData: [{
            id: 'jsd_1',
            jurisdictionId: 'jur_1',
            strategy: StrategyType.BUY_HOLD,
            data: {
              rentControlZone: false,
              strAllowed: true,
              minLotSizeByZone: { R1: 6000 },
            },
            updatedAt: now,
            updatedBy: null,
          }],
        },
      },
      taxLien: { faceAmount: 5000 },
      taxDeed: null,
      foreclosure: null,
      fixFlip: null,
      land: {
        id: 'land_1',
        dealId: 'deal_1',
        zoning: 'R1',
        access: 'ROAD',
        utilities: { water: true, sewer: true, electric: true },
        floodZone: 'X',
        wetlandsPercent: 0,
        hoaName: null,
        hoaFees: null,
        optionExpiry: null,
        sellerFinanceTerms: null,
        buyerFinanceTerms: null,
        dispositionStatus: null,
        listedPrice: null,
        dispositionDate: null,
        createdAt: now,
        updatedAt: now,
      },
      wholesale: null,
      buyHold: {
        actualMonthlyRent: null,
        targetMonthlyRent: 1800,
        fmrBedrooms: 3,
      },
      multifamily: null,
    })
    mocks.parcelDataCacheFindMany.mockResolvedValue([])
    mocks.fmrRateFindMany.mockResolvedValue([
      { bedrooms: 3, amount: 1750, year: 2026 },
      { bedrooms: 3, amount: 1600, year: 2025 },
    ])

    const investor = { financing: 'CASH' as const, holdMonthsTolerance: 24 }
    const context = await buildEvalContext('deal_1', 'tenant_1', investor)

    expect(mocks.dealFindFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'deal_1', tenantId: 'tenant_1' },
    }))
    expect(mocks.parcelDataCacheFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant_1',
        fipsCounty: '12095',
      }),
    }))
    expect(mocks.fmrRateFindMany).toHaveBeenCalledWith({
      where: { state: 'FL', county: 'Orange' },
      orderBy: { year: 'desc' },
    })
    expect(context.parcel.zoning).toBe('R1')
    expect(context.parcel.lienFaceValue).toBe(5000)
    expect(context.parcel.comparableRent).toBe(1800)
    expect(context.jurisdiction.minLotSizeSqFt('R1')).toBe(6000)
    expect(context.jurisdiction.fmr(3)).toBe(1750)
    expect(context.investor).toBe(investor)
    expect(context.strategy).toBe('BUY_HOLD')
  })
})
