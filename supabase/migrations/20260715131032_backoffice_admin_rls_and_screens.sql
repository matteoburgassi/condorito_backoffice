/*
# Backoffice admin RLS + data-driven screens

## Summary
Adds an admin identity layer and admin-gated write access so the Condorito
backoffice web app can create/update/delete content through the anon key + RLS
(never the service-role key). Existing public/anon SELECT policies the mobile
app relies on are left untouched. Also introduces two data-driven screen tables
so app layouts can change without a mobile release.

## 1. New Tables
- `admin_users`
  - `user_id` (uuid, PK, FK -> auth.users, cascade delete): identifies which
    auth users are backoffice admins.
  - `created_at` (timestamptz, default now()).
- `product_screens`
  - `id` (uuid PK), `slug` (text, unique), `title` (text),
    `is_active` (bool default true), `created_at`, `updated_at`.
- `product_screen_sections`
  - `id` (uuid PK), `screen_id` (uuid FK -> product_screens, cascade),
    `position` (int default 0), `type` (text), `config` (jsonb default '{}'),
    `is_active` (bool default true), `created_at`, `updated_at`.

## 2. New Function
- `is_admin()` — SECURITY DEFINER, STABLE, locked search_path. Returns true when
  the current auth user has a row in admin_users. Used by all admin write
  policies.

## 3. Security
- RLS enabled on admin_users, product_screens, product_screen_sections.
- admin_users: an admin may SELECT their own row.
- product_screens / product_screen_sections: public/anon SELECT of active rows
  (app reads them); INSERT/UPDATE/DELETE gated by is_admin().
- Admin-gated INSERT/UPDATE/DELETE policies added to every content/config table
  the backoffice manages. Pre-existing permissive authenticated write policies on
  `containers` and `collection_categories` are replaced with admin-gated ones so
  non-admin authenticated users cannot write. All existing public SELECT policies
  remain unchanged.

## Important Notes
1. No existing SELECT policy is modified, so mobile app reads are unaffected.
2. is_admin() is SECURITY DEFINER with a locked search_path to prevent
   privilege escalation.
3. Rollback: drop the new policies, function, and two new tables. Existing
   public SELECT behaviour is unaffected.
*/

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
-- Replace pre-existing permissive authenticated write policies with admin-gated ones.
DROP POLICY IF EXISTS "insert_containers" ON containers;
DROP POLICY IF EXISTS "update_containers" ON containers;
DROP POLICY IF EXISTS "delete_containers" ON containers;
DROP POLICY IF EXISTS "insert_collection_categories" ON collection_categories;
DROP POLICY IF EXISTS "update_collection_categories" ON collection_categories;
DROP POLICY IF EXISTS "delete_collection_categories" ON collection_categories;

DO $$
DECLARE
  t text;
  managed_tables text[] := ARRAY[
    'product_translations','product_assets','product_branding','product_config',
    'product_feature_flags','product_footer_items','product_footer_hidden_pages',
    'product_menu_items','product_menu_item_tiers','product_languages',
    'product_login_methods','product_unsub_methods','product_consumption_rules',
    'product_documents','product_document_content','product_languages',
    'containers','comics','comic_strips','jokes','characters',
    'collection_categories','games'
  ];
BEGIN
  FOREACH t IN ARRAY managed_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin_insert_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_admin())', 'admin_insert_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin_update_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin())', 'admin_update_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin_delete_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (is_admin())', 'admin_delete_' || t, t);
  END LOOP;
END $$;
