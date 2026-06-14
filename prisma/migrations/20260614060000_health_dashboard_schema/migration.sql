-- AlterTable User: add lastActiveAt
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- CreateTable EmailEvent
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "meta" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_type_timestamp_idx" ON "EmailEvent"("type", "timestamp");

-- CreateIndex
CREATE INDEX "EmailEvent_email_idx" ON "EmailEvent"("email");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
