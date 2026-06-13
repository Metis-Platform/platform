-- CreateTable
CREATE TABLE "BuyerBlastSend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerBlastSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerBlastSend_dealId_contactId_key" ON "BuyerBlastSend"("dealId", "contactId");

-- CreateIndex
CREATE INDEX "BuyerBlastSend_tenantId_idx" ON "BuyerBlastSend"("tenantId");

-- CreateIndex
CREATE INDEX "BuyerBlastSend_dealId_idx" ON "BuyerBlastSend"("dealId");

-- AddForeignKey
ALTER TABLE "BuyerBlastSend" ADD CONSTRAINT "BuyerBlastSend_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerBlastSend" ADD CONSTRAINT "BuyerBlastSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
