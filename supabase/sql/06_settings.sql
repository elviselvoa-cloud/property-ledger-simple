-- ============================================================
-- 06: Settings columns
-- Run this AFTER 05_landlord_bootstrap.sql
-- Adds payment details shown on the Settings page.
-- ============================================================

ALTER TABLE landlords
  ADD COLUMN IF NOT EXISTS mpesa_paybill VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
