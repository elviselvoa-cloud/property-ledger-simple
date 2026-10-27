-- ============================================================
-- 07: Roommates / co-staying
-- Run this AFTER 01_enums ... 06_settings (once is enough)
-- Adds multi-tenant leases with shared or separate billing.
-- ============================================================

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS is_roommate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(20) NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS roommates JSONB NOT NULL DEFAULT '[]'::jsonb;

-- billing_mode values:
--   'shared'   = one invoice covers the whole unit (roommates pay the primary tenant)
--   'separate' = each roommate gets their own invoice for their share

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_billing_mode_check'
  ) THEN
    ALTER TABLE leases
      ADD CONSTRAINT leases_billing_mode_check
      CHECK (billing_mode IN ('shared', 'separate'));
  END IF;
END $$;

-- roommates JSONB shape: [{"tenant_id": 12, "share": 7500}, ...]
-- tenant_id references tenants.id; share is the roommate's monthly amount in
-- KES and is used when billing_mode is 'separate' (null when 'shared').
COMMENT ON COLUMN leases.roommates IS
  'Array of {tenant_id, share} for co-staying leases; share in KES, used for separate billing.';

CREATE INDEX IF NOT EXISTS leases_is_roommate_idx ON leases(is_roommate) WHERE is_roommate;

-- Prevent duplicate invoices for the same lease, tenant and billing period
-- (split leases bill several tenants on the same lease in one month).
CREATE UNIQUE INDEX IF NOT EXISTS rent_invoices_lease_tenant_period_uniq
  ON rent_invoices(lease_id, tenant_id, period_month, period_year)
  WHERE status <> 'cancelled';

-- No new GRANTs needed: these are columns on the existing leases table,
-- whose privileges were granted in the earlier migrations.
