ALTER TABLE "AuditEvent" ADD COLUMN "requestId" TEXT;

CREATE INDEX "AuditEvent_tenantId_requestId_idx" ON "AuditEvent"("tenantId", "requestId");
