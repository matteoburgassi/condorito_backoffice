-- 1. Admin identity ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_own_admin_row" ON admin_users;
CREATE POLICY "admin_select_own_admin_row" ON admin_users FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION is_admin() FROM public;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- 2. Data-driven screens ----------------------------------------------------
CREATE TABLE IF NOT EXISTS product_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_screen_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid NOT NULL REFERENCES product_screens(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screen_sections_screen_position
  ON product_screen_sections (screen_id, position);

ALTER TABLE product_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_screen_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_screens" ON product_screens;
CREATE POLICY "public_read_active_screens" ON product_screens FOR SELECT
  TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admin_insert_product_screens" ON product_screens;
CREATE POLICY "admin_insert_product_screens" ON product_screens FOR INSERT
  TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_update_product_screens" ON product_screens;
CREATE POLICY "admin_update_product_screens" ON product_screens FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_delete_product_screens" ON product_screens;
CREATE POLICY "admin_delete_product_screens" ON product_screens FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "public_read_active_screen_sections" ON product_screen_sections;
CREATE POLICY "public_read_active_screen_sections" ON product_screen_sections FOR SELECT
  TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admin_insert_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_insert_product_screen_sections" ON product_screen_sections FOR INSERT
  TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_update_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_update_product_screen_sections" ON product_screen_sections FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_delete_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_delete_product_screen_sections" ON product_screen_sections FOR DELETE
  TO authenticated USING (is_admin());

-- 3. Admin-gated write policies on managed tables ---------------------------
-- NOTE: The managed-tables block from the original migration is skipped because
-- those tables (containers, comics, product_translations, etc.) do not exist in
-- this database. They should be created by the application's main schema
-- migrations before these policies can be applied.