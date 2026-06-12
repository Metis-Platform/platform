-- Add OPTION_EXPIRY value to EventType enum (land deal option deadlines)
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'OPTION_EXPIRY';
