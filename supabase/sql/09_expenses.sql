-- ============================================================
-- 09: Expenses table + RLS policies
-- ============================================================

-- ─── 0. Fallback helper functions (idempotent) ────────────────
DO $$
BEGIN
  -- Ensure get_landlord_id() exists so this migration can run independently
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_landlord_id' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.get_landlord_id()
    RETURNS BIGINT
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT l.id
      FROM public.landlords l
      JOIN public.users u ON u.id = l.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1;
    $$;
    GRANT EXECUTE ON FUNCTION public.get_landlord_id() TO authenticated, service_role;
  END IF;
END
$$;

-- ─── 1. Enum (idempotent) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'expense_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE expense_category AS ENUM (
      'repairs_maintenance',
      'utilities_water',
      'utilities_electricity',
      'caretaker_salary',
      'garbage_collection',
      'security',
      'taxes_rates',
      'management_fee',
      'other'
    );
  END IF;
END
$$;

-- ─── 2. Table (idempotent) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE SET NULL,
  category expense_category NOT NULL DEFAULT 'other',
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payee TEXT,
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS expenses_landlord_id_idx ON public.expenses(landlord_id);
CREATE INDEX IF NOT EXISTS expenses_property_id_idx ON public.expenses(property_id);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses(expense_date);

-- ─── 3. Data API Grants (required for PostgREST) ──────────────
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;

-- ─── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expenses: own landlord" ON public.expenses;
CREATE POLICY "Expenses: own landlord" ON public.expenses
  FOR ALL TO authenticated
  USING (landlord_id = public.get_landlord_id())
  WITH CHECK (landlord_id = public.get_landlord_id());

-- ─── 5. Auto-update updated_at Trigger ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS expenses_set_updated_at ON public.expenses;
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();