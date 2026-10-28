-- ============================================================
-- 08: Caretakers & property assignments
-- Run this AFTER 07_roommates.sql
-- ============================================================

-- ─── Caretakers ───────────────────────────────────────────────
CREATE TABLE caretakers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(320),
  national_id VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX caretakers_landlord_id_idx ON caretakers(landlord_id);

-- ─── Caretaker ↔ Property assignments ────────────────────────
CREATE TABLE caretaker_properties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caretaker_id BIGINT NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caretaker_id, property_id)
);

CREATE INDEX caretaker_properties_caretaker_id_idx ON caretaker_properties(caretaker_id);
CREATE INDEX caretaker_properties_property_id_idx ON caretaker_properties(property_id);

-- ─── Data API access (required) ──────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON caretakers TO authenticated;
GRANT ALL ON caretakers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON caretaker_properties TO authenticated;
GRANT ALL ON caretaker_properties TO service_role;

-- ─── Row Level Security ──────────────────────────────────────
ALTER TABLE caretakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE caretaker_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caretakers: own landlord" ON caretakers
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

CREATE POLICY "Caretaker properties: own landlord" ON caretaker_properties
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());

-- ─── Keep updated_at fresh ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS caretakers_set_updated_at ON caretakers;
CREATE TRIGGER caretakers_set_updated_at
  BEFORE UPDATE ON caretakers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: caretakers are managed by the landlord inside the app.
-- A dedicated caretaker login/portal will reuse these tables later
-- via a separate role mapping, never by storing roles on users.
