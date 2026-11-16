-- ============================================================
-- 11: WhatsApp & M-Pesa Integration Tables
-- Run this AFTER all previous migrations
-- ============================================================

-- 1. WhatsApp Bot Settings (add columns to landlords if not exists)
-- Check if columns exist before adding (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'whatsapp_mode') THEN
        ALTER TABLE landlords ADD COLUMN whatsapp_mode VARCHAR(20) DEFAULT 'shared' CHECK (whatsapp_mode IN ('shared', 'custom', 'disabled'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'whatsapp_phone_number_id') THEN
        ALTER TABLE landlords ADD COLUMN whatsapp_phone_number_id VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'whatsapp_access_token') THEN
        ALTER TABLE landlords ADD COLUMN whatsapp_access_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'whatsapp_verify_token') THEN
        ALTER TABLE landlords ADD COLUMN whatsapp_verify_token VARCHAR(100);
    END IF;
END $$;

-- 2. M-Pesa Daraja Settings (add columns to landlords if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'mpesa_environment') THEN
        ALTER TABLE landlords ADD COLUMN mpesa_environment VARCHAR(20) DEFAULT 'sandbox' CHECK (mpesa_environment IN ('sandbox', 'production'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'mpesa_shortcode') THEN
        ALTER TABLE landlords ADD COLUMN mpesa_shortcode VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'mpesa_passkey') THEN
        ALTER TABLE landlords ADD COLUMN mpesa_passkey TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'mpesa_consumer_key') THEN
        ALTER TABLE landlords ADD COLUMN mpesa_consumer_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'mpesa_consumer_secret') THEN
        ALTER TABLE landlords ADD COLUMN mpesa_consumer_secret TEXT;
    END IF;
END $$;

-- 3. M-Pesa STK Transactions Log
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    tenant_id BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    invoice_id BIGINT REFERENCES rent_invoices(id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100) UNIQUE,
    result_code INT,
    result_desc TEXT,
    mpesa_receipt_number VARCHAR(100),
    transaction_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    raw_callback_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. WhatsApp Message History / Audit Log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id BIGINT REFERENCES landlords(id) ON DELETE CASCADE,
    tenant_id BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_phone VARCHAR(20) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    meta_message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes & RLS
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_tenant ON mpesa_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_landlord ON mpesa_transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_wa_sender ON whatsapp_messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_wa_landlord ON whatsapp_messages(landlord_id);

-- Enable RLS on new tables
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mpesa_transactions
DROP POLICY IF EXISTS "Landlords view own mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Landlords view own mpesa transactions" ON mpesa_transactions
    FOR ALL TO authenticated USING (landlord_id = get_landlord_id());

-- RLS Policies for whatsapp_messages
DROP POLICY IF EXISTS "Landlords view own whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Landlords view own whatsapp messages" ON whatsapp_messages
    FOR ALL TO authenticated USING (landlord_id = get_landlord_id());