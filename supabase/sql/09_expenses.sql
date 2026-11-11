-- ============================================================
-- 09: Expenses table + RLS policies
-- ============================================================

-- ─── Enum ─────────────────────────────────────────────────────
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

-- ─── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landlord_id BIGINT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES properties(id) ON DELETE SET NULL,
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

CREATE INDEX expenses_landlord_id_idx ON expenses(landlord_id);
CREATE INDEX expenses_property_id_idx ON expenses(property_id);
CREATE INDEX expenses_expense_date_idx ON expenses(expense_date);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses: own landlord" ON expenses
  FOR ALL TO authenticated
  USING (landlord_id = get_landlord_id())
  WITH CHECK (landlord_id = get_landlord_id());
