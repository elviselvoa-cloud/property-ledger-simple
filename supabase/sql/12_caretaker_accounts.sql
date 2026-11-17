-- ============================================================
-- 12: Caretaker Accounts & Role-Based Permissions
-- Run this AFTER 08_caretakers.sql
-- ============================================================

-- ─── 0. Add caretaker role to user_role enum ──────────────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'caretaker';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── 1. Mark caretakers with linked auth accounts ─────────────
ALTER TABLE caretakers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email VARCHAR(320),
  ADD COLUMN IF NOT EXISTS invite_token TEXT,
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_signed_in TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS caretakers_auth_user_id_idx ON caretakers(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS caretakers_email_unique_idx ON caretakers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS caretakers_invite_token_idx ON caretakers(invite_token) WHERE invite_token IS NOT NULL;

-- ─── 2. Caretaker Permissions (tab-level access) ──────────────
CREATE TABLE IF NOT EXISTS caretaker_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caretaker_id BIGINT NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
  tab_key VARCHAR(50) NOT NULL CHECK (tab_key IN (
    'properties', 'units', 'tenants', 'leases',
    'payments', 'invoices', 'expenses', 'reports', 'settings'
  )),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caretaker_id, tab_key)
);

CREATE INDEX IF NOT EXISTS caretaker_permissions_caretaker_id_idx ON caretaker_permissions(caretaker_id);

-- Allow caretakers to read their granted tabs' data for the landlord they serve
ALTER TABLE caretaker_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caretaker permissions: own" ON caretaker_permissions;
CREATE POLICY "Caretaker permissions: own" ON caretaker_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM caretakers c
      WHERE c.id = caretaker_permissions.caretaker_id
        AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM caretakers c
      WHERE c.id = caretaker_permissions.caretaker_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Landlords: manage caretaker permissions" ON caretaker_permissions;
CREATE POLICY "Landlords: manage caretaker permissions" ON caretaker_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM landlords l
      JOIN caretakers c ON c.landlord_id = l.id
      WHERE c.id = caretaker_permissions.caretaker_id
        AND l.id = get_landlord_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM landlords l
      JOIN caretakers c ON c.landlord_id = l.id
      WHERE c.id = caretaker_permissions.caretaker_id
        AND l.id = get_landlord_id()
    )
  );

-- ─── 3. Auto-update updated_at trigger for permissions ────────
DROP TRIGGER IF EXISTS caretaker_permissions_set_updated_at ON caretaker_permissions;
CREATE TRIGGER caretaker_permissions_set_updated_at
  BEFORE UPDATE ON caretaker_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 4. Helper: check if current authenticated user is a caretaker ─
CREATE OR REPLACE FUNCTION public.is_caretaker()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM caretakers c
    WHERE c.auth_user_id = auth.uid()
      AND c.is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_caretaker_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM caretakers c
  WHERE c.auth_user_id = auth.uid() AND c.is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_caretaker_landlord_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.landlord_id FROM caretakers c
  WHERE c.auth_user_id = auth.uid() AND c.is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.is_caretaker() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caretaker_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caretaker_landlord_id() TO authenticated;

-- ─── 5. RLS: allow caretakers to read data for their assigned properties ─
-- Properties: caretaker can see all
ALTER POLICY "Properties: own landlord" ON properties USING (
  landlord_id = get_landlord_id()
  OR (is_caretaker() AND landlord_id = COALESCE(get_caretaker_landlord_id(), 0))
);

-- Units: caretaker can see all units in their assigned properties
ALTER POLICY "Units: own landlord" ON units USING (
  landlord_id = get_landlord_id()
  OR (is_caretaker() AND landlord_id = COALESCE(get_caretaker_landlord_id(), 0))
);

-- Tenants: caretaker can see tenants in their assigned properties
ALTER POLICY "Tenants: own landlord" ON tenants USING (
  landlord_id = get_landlord_id()
  OR (is_caretaker() AND landlord_id = COALESCE(get_caretaker_landlord_id(), 0))
);

-- Leases: caretaker can see leases in their assigned properties
ALTER POLICY "Leases: own landlord" ON leases USING (
  landlord_id = get_landlord_id()
  OR (is_caretaker() AND landlord_id = COALESCE(get_caretaker_landlord_id(), 0))
);

-- ─── 6. Helper: find caretaker by invite token ───────────────────
CREATE OR REPLACE FUNCTION public.find_caretaker_by_invite_token(p_token TEXT)
RETURNS SETOF caretakers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM caretakers
  WHERE invite_token = p_token
    AND is_active = true
    AND auth_user_id IS NULL
    AND account_created_at IS NULL
$$;

GRANT EXECUTE ON FUNCTION public.find_caretaker_by_invite_token(TEXT) TO authenticated, service_role;

-- ─── 7. Update last_signed_in on auth (via trigger on users table) ─
-- Note: We track last_signed_in on the caretakers table via the webhook
-- or via the sign-in flow. This can be updated by a separate function.

-- ─── 8. Edge Function Grant ────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
