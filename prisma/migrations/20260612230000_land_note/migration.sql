-- Add PAYMENT_LATE to EventType enum
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PAYMENT_LATE';

-- Create LandNoteStatus enum
DO $$ BEGIN
  CREATE TYPE "LandNoteStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'DEFAULTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create LandNote table
CREATE TABLE IF NOT EXISTS "LandNote" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "principal" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(6,4) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "paymentAmount" DECIMAL(14,2) NOT NULL,
    "firstPaymentDate" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "status" "LandNoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandNote_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "LandNote_dealId_idx" ON "LandNote"("dealId");
CREATE INDEX IF NOT EXISTS "LandNote_tenantId_idx" ON "LandNote"("tenantId");

-- Foreign key
ALTER TABLE "LandNote" ADD CONSTRAINT "LandNote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
