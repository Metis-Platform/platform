-- Add redeemable deed as a first-class jurisdiction investment type.
-- Existing seed data already uses this value for redeemable-deed states such as Texas.
ALTER TYPE "InvestmentType" ADD VALUE IF NOT EXISTS 'REDEEMABLE_DEED';
