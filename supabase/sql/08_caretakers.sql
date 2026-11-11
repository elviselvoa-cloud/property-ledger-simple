-- ============================================================
-- 08: Caretakers & property assignments (Self-contained)
-- ============================================================

-- ─── 0. Ensure Landlord Helper Functions Exist ───────────────
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

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

GRANT EXECUTE ON FUNCTION public.get_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_landlord_id() TO authenticated, service_role;

-- ─── 1. Caretakers Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.caretakers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(320),
  national_id VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS caretakers_landlord_id_idx 
  ON public.caretakers(landlord_id);

-- ─── 2. Caretaker ↔ Property Assignments Table ───────────────
CREATE TABLE IF NOT EXISTS public.caretaker_properties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caretaker_id BIGINT NOT NULL REFERENCES public.caretakers(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id BIGINT NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caretaker_id, property_id)
);

CREATE INDEX IF NOT EXISTS caretaker_properties_caretaker_id_idx 
  ON public.caretaker_properties(caretaker_id);
CREATE INDEX IF NOT EXISTS caretaker_properties_property_id_idx 
  ON public.caretaker_properties(property_id);

-- ─── 3. Data API Grants (Required for PostgREST) ─────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caretakers TO authenticated;
GRANT ALL ON public.caretakers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caretaker_properties TO authenticated;
GRANT ALL ON public.caretaker_properties TO service_role;

-- ─── 4. Row Level Security Policies ──────────────────────────
ALTER TABLE public.caretakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caretaker_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caretakers: own landlord" ON public.caretakers;
CREATE POLICY "Caretakers: own landlord" ON public.caretakers
  FOR ALL TO authenticated
  USING (landlord_id = public.get_landlord_id())
  WITH CHECK (landlord_id = public.get_landlord_id());

DROP POLICY IF EXISTS "Caretaker properties: own landlord" ON public.caretaker_properties;
CREATE POLICY "Caretaker properties: own landlord" ON public.caretaker_properties
  FOR ALL TO authenticated
  USING (landlord_id = public.get_landlord_id())
  WITH CHECK (landlord_id = public.get_landlord_id());

-- ─── 5. Auto-update updated_at Trigger ───────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS caretakers_set_updated_at ON public.caretakers;
CREATE TRIGGER caretakers_set_updated_at
  BEFORE UPDATE ON public.caretakers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
