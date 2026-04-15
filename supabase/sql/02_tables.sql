-- ============================================================
-- 02: Tables
-- Run this AFTER 01_enums.sql
-- ============================================================

-- ─── Users ────────────────────────────────────────────────────
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  open_id VARCHAR(64) UNIQUE,
  name TEXT,
  email VARCHAR(320),
  login_method VARCHAR(64),
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_signed_in TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_auth_id_idx ON users(auth_id);

-- ─── Landlords ────────────────────────────────────────────────
CREATE TABLE landlords (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Kenya',
  subscription_plan subscription_plan_type NOT NULL DEFAULT 'free',
  subscription_status subscription_status_type NOT NULL DEFAULT 'active',
  subscription_expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_status onboarding_status_type NOT NULL DEFAULT 'not_started',
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX landlords_user_id_idx ON landlords(user_id);

-- ─── Properties ───────────────────────────────────────────────
CREATE TABLE properties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  property_type property_type NOT NULL DEFAULT 'residential',
  total_units INT NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX properties_landlord_id_idx ON properties(landlord_id);

-- ─── Units ────────────────────────────────────────────────────
CREATE TABLE units (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  unit_number VARCHAR(50) NOT NULL,
  floor VARCHAR(20),
  bedrooms INT DEFAULT 1,
  bathrooms INT DEFAULT 1,
  size NUMERIC(10, 2),
  rent_amount NUMERIC(12, 2) NOT NULL,
  deposit_amount NUMERIC(12, 2),
  status unit_status NOT NULL DEFAULT 'vacant',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX units_property_id_idx ON units(property_id);
CREATE INDEX units_landlord_id_idx ON units(landlord_id);

-- ─── Tenants ──────────────────────────────────────────────────
CREATE TABLE tenants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(30),
  national_id VARCHAR(50),
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(30),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tenants_landlord_id_idx ON tenants(landlord_id);

-- ─── Leases ───────────────────────────────────────────────────
CREATE TABLE leases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  unit_id BIGINT NOT NULL REFERENCES units(id),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  rent_amount NUMERIC(12, 2) NOT NULL,
  deposit_amount NUMERIC(12, 2),
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  rent_due_day INT NOT NULL DEFAULT 1,
  status lease_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX leases_landlord_id_idx ON leases(landlord_id);
CREATE INDEX leases_tenant_id_idx ON leases(tenant_id);
CREATE INDEX leases_unit_id_idx ON leases(unit_id);

-- ─── Rent Invoices ────────────────────────────────────────────
CREATE TABLE rent_invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  lease_id BIGINT NOT NULL REFERENCES leases(id),
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  unit_id BIGINT NOT NULL REFERENCES units(id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoices_landlord_id_idx ON rent_invoices(landlord_id);
CREATE INDEX invoices_lease_id_idx ON rent_invoices(lease_id);
CREATE INDEX invoices_tenant_id_idx ON rent_invoices(tenant_id);
CREATE INDEX invoices_status_idx ON rent_invoices(status);

-- ─── Payments ─────────────────────────────────────────────────
CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES rent_invoices(id),
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  amount NUMERIC(12, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  mpesa_transaction_id VARCHAR(100),
  bank_reference VARCHAR(100),
  receipt_number VARCHAR(100),
  payment_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_landlord_id_idx ON payments(landlord_id);
CREATE INDEX payments_invoice_id_idx ON payments(invoice_id);
CREATE INDEX payments_tenant_id_idx ON payments(tenant_id);

-- ─── Subscription Plans ───────────────────────────────────────
CREATE TABLE subscription_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name subscription_plan_type NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  max_units INT,
  max_properties INT,
  features TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Subscriptions ────────────────────────────────────────────
CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
  status subscription_status_type NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  mpesa_transaction_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_landlord_id_idx ON subscriptions(landlord_id);

-- ─── Notifications ────────────────────────────────────────────
CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id BIGINT REFERENCES tenants(id),
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_landlord_id_idx ON notifications(landlord_id);
CREATE INDEX notifications_tenant_id_idx ON notifications(tenant_id);

-- ─── Documents ────────────────────────────────────────────────
CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id BIGINT REFERENCES tenants(id),
  lease_id BIGINT REFERENCES leases(id),
  payment_id BIGINT REFERENCES payments(id),
  name VARCHAR(255) NOT NULL,
  file_key VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  document_type document_type NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_landlord_id_idx ON documents(landlord_id);
CREATE INDEX documents_tenant_id_idx ON documents(tenant_id);
CREATE INDEX documents_lease_id_idx ON documents(lease_id);

-- ─── Audit Logs ───────────────────────────────────────────────
CREATE TABLE audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  landlord_id BIGINT REFERENCES landlords(id),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id BIGINT,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_landlord_id_idx ON audit_logs(landlord_id);
