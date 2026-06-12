-- Add checklistKey to Task for idempotent checklist item tracking
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "checklistKey" TEXT;
