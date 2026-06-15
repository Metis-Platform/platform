-- Contact CRM primitive: pipeline stage, activity log, new contact types

-- Extend ContactType enum (each ADD VALUE must be a separate statement)
ALTER TYPE "ContactType" ADD VALUE IF NOT EXISTS 'CONTRACTOR';
ALTER TYPE "ContactType" ADD VALUE IF NOT EXISTS 'TENANT';
ALTER TYPE "ContactType" ADD VALUE IF NOT EXISTS 'VENDOR';

-- New enums
CREATE TYPE "ContactPipelineStage" AS ENUM ('LEAD', 'CONTACTED', 'NEGOTIATING', 'UNDER_CONTRACT', 'CLOSED', 'DEAD');
CREATE TYPE "ContactActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'TEXT', 'MEETING', 'OFFER_SENT', 'CONTRACT_SENT', 'OTHER');

-- Add pipelineStage to Contact
ALTER TABLE "Contact" ADD COLUMN "pipelineStage" "ContactPipelineStage" NOT NULL DEFAULT 'LEAD';

-- Additional indexes on Contact
CREATE INDEX "Contact_tenantId_type_idx" ON "Contact"("tenantId", "type");
CREATE INDEX "Contact_tenantId_pipelineStage_idx" ON "Contact"("tenantId", "pipelineStage");

-- ContactActivity table
CREATE TABLE "ContactActivity" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "ContactActivityType" NOT NULL,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactActivity_contactId_idx" ON "ContactActivity"("contactId");
CREATE INDEX "ContactActivity_tenantId_idx" ON "ContactActivity"("tenantId");

ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
