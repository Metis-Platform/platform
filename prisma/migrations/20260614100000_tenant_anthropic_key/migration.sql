-- Add Anthropic API key to Tenant (BYOK — tenant-supplied, never platform key)
ALTER TABLE "Tenant" ADD COLUMN "anthropicApiKey" TEXT;
