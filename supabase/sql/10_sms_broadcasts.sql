-- ============================================================
-- 10: SMS Reminders & Estate Broadcasts
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────
CREATE TYPE sms_message_type AS ENUM (
  'rent_reminder',
  'payment_receipt',
  'estate_broadcast',
  'custom',
  'overdue_notice'
);

CREATE TYPE sms_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed'
);

-- ─── Extend landlords table ───────────────────────────────────
DO $$ BEGIN
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS sms_provider VARCHAR(50) DEFAULT 'africastalking';
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS sms_username VARCHAR(100);
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS sms_api_key TEXT;
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR(11) DEFAULT 'PROPLEDGER';
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS auto_rent_reminders BOOLEAN DEFAULT false;
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS reminder_days_before INT DEFAULT 2;
  ALTER TABLE landlords ADD COLUMN IF NOT EXISTS reminder_days_after_overdue INT DEFAULT 3;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─── sms_logs table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
  property_id BIGINT REFERENCES properties(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone VARCHAR(25) NOT NULL,
  message_type sms_message_type NOT NULL DEFAULT 'custom',
  message_body TEXT NOT NULL,
  segments_count INT NOT NULL DEFAULT 1,
  status sms_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  cost_kes NUMERIC(8, 2) DEFAULT 0.00,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_logs_landlord_id_idx ON sms_logs(landlord_id);
CREATE INDEX sms_logs_tenant_id_idx ON sms_logs(tenant_id);
CREATE INDEX sms_logs_property_id_idx ON sms_logs(property_id);
CREATE INDEX sms_logs_status_idx ON sms_logs(status);
CREATE INDEX sms_logs_created_at_idx ON sms_logs(created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SMS logs: own landlord" ON sms_logs
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());
