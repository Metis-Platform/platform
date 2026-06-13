-- Add loanMaturityDate to DealMultifamily (Phase 1 — loan maturity events)
ALTER TABLE "DealMultifamily" ADD COLUMN "loanMaturityDate" TIMESTAMP(3);

-- Add LOAN_MATURITY to EventType enum
ALTER TYPE "EventType" ADD VALUE 'LOAN_MATURITY';
