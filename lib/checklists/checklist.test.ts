import { describe, it, expect } from 'vitest'
import { computeMissingItems, checklistProgress } from './instantiate'
import type { ChecklistTemplate } from './types'

// ---------------------------------------------------------------------------
// Fixture template — does NOT use the live registry; content is for tests only
// ---------------------------------------------------------------------------

function day(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month - 1, date))
}

const FIXTURE_TEMPLATE: ChecklistTemplate = {
  strategy: 'TAX_LIEN',
  label: 'Test Lien Checklist',
  items: [
    {
      key: 'verify-parcel',
      title: 'Verify parcel & assessed value',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
    },
    {
      key: 'check-occupancy',
      title: 'Occupancy / structure check',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'set-max-bid',
      title: 'Set max bid',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'auctionDate',
      dueOffsetDays: 0,
    },
    {
      key: 'record-certificate',
      title: 'Record certificate',
      taskType: 'RECORD_DOCUMENT',
      defaultPriority: 'HIGH',
      dueAnchor: 'issueDate',
      dueOffsetDays: 30,
    },
  ],
}

const DEAL_NO_DATES = {
  purchaseDate: null,
  auctionDate: null,
  issueDate: null,
  redemptionDeadline: null,
  foreclosureEligibleDate: null,
  saleDate: null,
}

const AUCTION = day(2025, 3, 15)
const ISSUE   = day(2025, 3, 15)

const DEAL_WITH_DATES = {
  ...DEAL_NO_DATES,
  auctionDate: AUCTION,
  issueDate: ISSUE,
}

// ---------------------------------------------------------------------------
// computeMissingItems
// ---------------------------------------------------------------------------

describe('computeMissingItems', () => {
  it('returns all items when nothing exists yet', () => {
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, [])
    expect(result).toHaveLength(4)
    expect(result.map(r => r.checklistKey)).toEqual([
      'verify-parcel', 'check-occupancy', 'set-max-bid', 'record-certificate',
    ])
  })

  it('skips items whose checklistKey already exists (idempotent)', () => {
    const existing = [{ checklistKey: 'verify-parcel' }, { checklistKey: 'set-max-bid' }]
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, existing)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.checklistKey)).toEqual(['check-occupancy', 'record-certificate'])
  })

  it('returns nothing when all items already exist', () => {
    const existing = FIXTURE_TEMPLATE.items.map(i => ({ checklistKey: i.key }))
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, existing)
    expect(result).toHaveLength(0)
  })

  it('restores a deleted item when re-run (missing key reappears)', () => {
    // Simulate: 4 tasks created, user deletes 'check-occupancy', re-runs generate
    const existing = [
      { checklistKey: 'verify-parcel' },
      { checklistKey: 'set-max-bid' },
      { checklistKey: 'record-certificate' },
    ]
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, existing)
    expect(result).toHaveLength(1)
    expect(result[0].checklistKey).toBe('check-occupancy')
  })

  it('items without dueAnchor get no dueDate', () => {
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_WITH_DATES, [])
    const verifyParcel = result.find(r => r.checklistKey === 'verify-parcel')!
    expect(verifyParcel.dueDate).toBeNull()
  })

  it('items with dueAnchor and anchor present compute correct dueDate', () => {
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_WITH_DATES, [])

    // check-occupancy: auctionDate - 7 days
    const occupancy = result.find(r => r.checklistKey === 'check-occupancy')!
    const expectedOccupancy = day(2025, 3, 8) // March 15 − 7 days
    expect(occupancy.dueDate?.toISOString()).toBe(expectedOccupancy.toISOString())

    // set-max-bid: auctionDate + 0 days = auctionDate
    const maxBid = result.find(r => r.checklistKey === 'set-max-bid')!
    expect(maxBid.dueDate?.toISOString()).toBe(AUCTION.toISOString())

    // record-certificate: issueDate + 30 days
    const cert = result.find(r => r.checklistKey === 'record-certificate')!
    const expectedCert = day(2025, 4, 14) // March 15 + 30 = April 14
    expect(cert.dueDate?.toISOString()).toBe(expectedCert.toISOString())
  })

  it('items with dueAnchor but anchor is null get no dueDate', () => {
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, [])
    const occupancy = result.find(r => r.checklistKey === 'check-occupancy')!
    expect(occupancy.dueDate).toBeNull()
  })

  it('copies title, description, taskType, priority to each spec', () => {
    const result = computeMissingItems(FIXTURE_TEMPLATE, DEAL_NO_DATES, [])
    const cert = result.find(r => r.checklistKey === 'record-certificate')!
    expect(cert.title).toBe('Record certificate')
    expect(cert.taskType).toBe('RECORD_DOCUMENT')
    expect(cert.priority).toBe('HIGH')
    expect(cert.description).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// checklistProgress
// ---------------------------------------------------------------------------

describe('checklistProgress', () => {
  it('returns 0/0 for no tasks', () => {
    expect(checklistProgress([])).toEqual({ completed: 0, total: 0 })
  })

  it('ignores tasks with null checklistKey', () => {
    const tasks = [
      { checklistKey: null, status: 'COMPLETED' },
      { checklistKey: null, status: 'OPEN' },
    ]
    expect(checklistProgress(tasks)).toEqual({ completed: 0, total: 0 })
  })

  it('counts only checklist tasks', () => {
    const tasks = [
      { checklistKey: 'a', status: 'COMPLETED' },
      { checklistKey: 'b', status: 'OPEN' },
      { checklistKey: null, status: 'COMPLETED' },
    ]
    expect(checklistProgress(tasks)).toEqual({ completed: 1, total: 2 })
  })

  it('returns total === all checklist tasks, completed === COMPLETED ones', () => {
    const tasks = [
      { checklistKey: 'a', status: 'COMPLETED' },
      { checklistKey: 'b', status: 'COMPLETED' },
      { checklistKey: 'c', status: 'OPEN' },
      { checklistKey: 'd', status: 'IN_PROGRESS' },
    ]
    expect(checklistProgress(tasks)).toEqual({ completed: 2, total: 4 })
  })
})
