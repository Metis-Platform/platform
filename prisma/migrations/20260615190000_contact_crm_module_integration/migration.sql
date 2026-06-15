-- Contact CRM module integration: FK columns on DealFixFlip, DealBuyHold, DealMultifamily, LandNote

ALTER TABLE "DealFixFlip" ADD COLUMN "contractorContactId" TEXT;
ALTER TABLE "DealFixFlip" ADD CONSTRAINT "DealFixFlip_contractorContactId_fkey"
  FOREIGN KEY ("contractorContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DealFixFlip_contractorContactId_idx" ON "DealFixFlip"("contractorContactId");

ALTER TABLE "DealBuyHold" ADD COLUMN "tenantContactId" TEXT;
ALTER TABLE "DealBuyHold" ADD CONSTRAINT "DealBuyHold_tenantContactId_fkey"
  FOREIGN KEY ("tenantContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DealBuyHold_tenantContactId_idx" ON "DealBuyHold"("tenantContactId");

ALTER TABLE "DealBuyHold" ADD COLUMN "propertyManagerContactId" TEXT;
ALTER TABLE "DealBuyHold" ADD CONSTRAINT "DealBuyHold_propertyManagerContactId_fkey"
  FOREIGN KEY ("propertyManagerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DealBuyHold_propertyManagerContactId_idx" ON "DealBuyHold"("propertyManagerContactId");

ALTER TABLE "DealMultifamily" ADD COLUMN "propertyManagerContactId" TEXT;
ALTER TABLE "DealMultifamily" ADD CONSTRAINT "DealMultifamily_propertyManagerContactId_fkey"
  FOREIGN KEY ("propertyManagerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DealMultifamily_propertyManagerContactId_idx" ON "DealMultifamily"("propertyManagerContactId");

ALTER TABLE "LandNote" ADD COLUMN "buyerContactId" TEXT;
ALTER TABLE "LandNote" ADD CONSTRAINT "LandNote_buyerContactId_fkey"
  FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LandNote_buyerContactId_idx" ON "LandNote"("buyerContactId");
