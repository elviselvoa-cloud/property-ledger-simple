-- ============================================================
-- 03: Row Level Security Policies
-- Run this AFTER 02_tables.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get current user's internal ID ───────────────────
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$;

-- ─── Helper: get current user's landlord ID ───────────────────
CREATE OR REPLACE FUNCTION get_landlord_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM landlords WHERE user_id = get_user_id() LIMIT 1
$$;

-- ─── Helper: check if user is admin ───────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  )
$$;

-- ─── Users ────────────────────────────────────────────────────
CREATE POLICY "Users can read own row" ON users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update own row" ON users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT TO authenticated
  USING (is_admin());

-- ─── Landlords ────────────────────────────────────────────────
CREATE POLICY "Landlords: own data" ON landlords
  FOR ALL TO authenticated
  USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

CREATE POLICY "Admins: all landlords" ON landlords
  FOR SELECT TO authenticated
  USING (is_admin());

-- ─── Properties ───────────────────────────────────────────────
CREATE POLICY "Properties: own landlord" ON properties
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Units ────────────────────────────────────────────────────
CREATE POLICY "Units: own landlord" ON units
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Tenants ──────────────────────────────────────────────────
CREATE POLICY "Tenants: own landlord" ON tenants
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Leases ───────────────────────────────────────────────────
CREATE POLICY "Leases: own landlord" ON leases
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Rent Invoices ────────────────────────────────────────────
CREATE POLICY "Invoices: own landlord" ON rent_invoices
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Payments ─────────────────────────────────────────────────
CREATE POLICY "Payments: own landlord" ON payments
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Subscription Plans (read-only for all) ───────────────────
CREATE POLICY "Plans: anyone can read" ON subscription_plans
  FOR SELECT TO authenticated
  USING (true);

-- ─── Subscriptions ────────────────────────────────────────────
CREATE POLICY "Subscriptions: own landlord" ON subscriptions
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Notifications ────────────────────────────────────────────
CREATE POLICY "Notifications: own landlord" ON notifications
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Documents ────────────────────────────────────────────────
CREATE POLICY "Documents: own landlord" ON documents
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Audit Logs ───────────────────────────────────────────────
CREATE POLICY "Audit logs: own landlord or admin" ON audit_logs
  FOR SELECT TO authenticated
  USING (landlord_id = get_landlord_id() OR is_admin());

CREATE POLICY "Audit logs: insert own" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id());
