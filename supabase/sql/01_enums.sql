-- ============================================================
-- 01: Custom Enum Types
-- Run this FIRST in your Supabase SQL Editor
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE subscription_plan_type AS ENUM ('free', 'basic', 'pro');
CREATE TYPE subscription_status_type AS ENUM ('active', 'expired', 'cancelled', 'past_due');
CREATE TYPE onboarding_status_type AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');
CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'mixed');
CREATE TYPE unit_status AS ENUM ('vacant', 'occupied', 'maintenance');
CREATE TYPE lease_status AS ENUM ('active', 'expired', 'terminated', 'pending');
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'partial', 'cancelled');
CREATE TYPE payment_method AS ENUM ('mpesa', 'bank_transfer', 'cash', 'other');
CREATE TYPE notification_type AS ENUM ('rent_reminder', 'payment_confirmation', 'payment_request', 'payment_received', 'overdue_alert', 'subscription_expiry', 'general');
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'in_app');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'read');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE document_type AS ENUM ('lease_agreement', 'tenant_id', 'payment_receipt', 'property_photo', 'other');
