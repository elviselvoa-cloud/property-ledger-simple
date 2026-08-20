-- ============================================================
-- 05: Auto-create a landlord profile for every new user
-- Run this AFTER 04_functions.sql
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id BIGINT;
BEGIN
  INSERT INTO users (auth_id, email, name, last_signed_in)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    now()
  )
  RETURNING id INTO new_user_id;

  INSERT INTO landlords (user_id, business_name, trial_ends_at)
  VALUES (
    new_user_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    now() + interval '30 days'
  );

  RETURN NEW;
END;
$$;

-- Backfill for users created before this change
INSERT INTO landlords (user_id, business_name, trial_ends_at)
SELECT u.id, COALESCE(u.name, split_part(u.email, '@', 1)), now() + interval '30 days'
FROM users u
LEFT JOIN landlords l ON l.user_id = u.id
WHERE l.id IS NULL;
