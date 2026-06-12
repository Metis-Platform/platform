import type { TransactionType } from '@/app/generated/prisma'

/** Whether a transaction type represents money coming IN or going OUT. */
export const TRANSACTION_DIRECTION: Record<TransactionType, 'IN' | 'OUT'> = {
  REDEMPTION_RECEIVED:   'IN',
  OTHER_INCOME:          'IN',
  SALE_PROCEEDS:         'IN',
  RENT_RECEIVED:         'IN',
  NOTE_PAYMENT_RECEIVED: 'IN',
  PURCHASE:              'OUT',
  SUBSEQUENT_TAX:        'OUT',
  LEGAL_FEE:             'OUT',
  TITLE_SEARCH:          'OUT',
  RECORDING_FEE:         'OUT',
  OTHER_EXPENSE:         'OUT',
  REHAB_COST:            'OUT',
  INSURANCE:             'OUT',
  PROPERTY_TAX:          'OUT',
  HOA_FEE:               'OUT',
  MANAGEMENT_FEE:        'OUT',
  LOAN_PAYMENT:          'OUT',
}

/** Human-readable labels for display. */
export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  PURCHASE:              'Purchase',
  SUBSEQUENT_TAX:        'Subsequent Tax',
  LEGAL_FEE:             'Legal Fee',
  TITLE_SEARCH:          'Title Search',
  RECORDING_FEE:         'Recording Fee',
  REDEMPTION_RECEIVED:   'Redemption Received',
  OTHER_INCOME:          'Other Income',
  OTHER_EXPENSE:         'Other Expense',
  SALE_PROCEEDS:         'Sale Proceeds',
  RENT_RECEIVED:         'Rent Received',
  NOTE_PAYMENT_RECEIVED: 'Note Payment Received',
  REHAB_COST:            'Rehab Cost',
  INSURANCE:             'Insurance',
  PROPERTY_TAX:          'Property Tax',
  HOA_FEE:               'HOA Fee',
  MANAGEMENT_FEE:        'Management Fee',
  LOAN_PAYMENT:          'Loan Payment',
}
