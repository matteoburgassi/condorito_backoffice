/*
# Consolidate data-driven screens schema (product_screens + product_screen_sections)

## Summary
Collapses the three incremental screen migrations
(`backoffice_admin_rls_and_screens`, `admin_select_all_screens`,
`screens_product_scope`) into a single idempotent definition of the
data-driven screen tables in their FINAL shape. Safe to re-run and safe to
apply to the already-migrated database — every statement is guarded.

This migration does NOT create `admin_users` / `is_admin()` (owned by the
earlier retained migration) and does NOT seed any rows; it only defines the
two screen tables, their indexes, and their RLS policies.

## Tables (final shape)
- `product_screens`
  - `id` (uuid PK), `product_id` (uuid, nullable, FK -> product_products,
    cascade delete), `slug` (text), `title` (text), `is_active` (bool),
    `created_at`, `updated_at`. Uniqueness is per-product on
    `(product_id, slug)`.
- `product_screen_sections`
  - `id` (uuid PK), `screen_id` (uuid FK -> product_screens, cascade),
    `position` (int), `type` (text), `config` (jsonb), `is_active` (bool),
    `created_at`, `updated_at`.

## Indexes
- Unique `product_screens_product_slug_key` on `(product_id, slug)`.
- `idx_product_screens_product` on `(product_id)`.
- `idx_screen_sections_screen_position` on `(screen_id, position)`.

## Security (RLS)
- RLS enabled on both tables.
- `product_screens`: anon+authenticated SELECT of active rows; authenticated
  admins (via `is_admin()`) may SELECT all rows and INSERT/UPDATE/DELETE.
- `product_screen_sections`: same policy shape as above.

## Important Notes
1. Idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `DROP POLICY IF EXISTS` + `CREATE POLICY`, and drop/create for the unique
   index. Applying against the existing database is a no-op.
2. `product_id` is intentionally NULLABLE to stay non-destructive; pre-existing
   rows are backfilled to the default Condorito product when it exists.
3. Depends on `is_admin()` and `product_products` already existing (created by
   earlier migrations that are retained).
*/

-- 1. Tables (final shape; slug is NOT globally unique -- see composite index) --
CREATE TABLE IF NOT EXISTS product_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES product_products(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure product_id exists on a pre-existing table created before scoping.
ALTER TABLE product_screens
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES product_products(id) ON DELETE CASCADE;

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

-- 2. Backfill pre-existing rows to the default Condorito product. -------------
UPDATE product_screens
SET product_id = (SELECT id FROM product_products WHERE slug = 'condorito-cl' LIMIT 1)
WHERE product_id IS NULL;

-- 3. Indexes: per-product slug uniqueness replaces any old global unique. ------
ALTER TABLE product_screens DROP CONSTRAINT IF EXISTS product_screens_slug_key;

DROP INDEX IF EXISTS product_screens_product_slug_key;
CREATE UNIQUE INDEX product_screens_product_slug_key
  ON product_screens (product_id, slug);

CREATE INDEX IF NOT EXISTS idx_product_screens_product
  ON product_screens (product_id);

CREATE INDEX IF NOT EXISTS idx_screen_sections_screen_position
  ON product_screen_sections (screen_id, position);

-- 4. RLS ----------------------------------------------------------------------
ALTER TABLE product_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_screen_sections ENABLE ROW LEVEL SECURITY;

-- product_screens policies
DROP POLICY IF EXISTS "public_read_active_screens" ON product_screens;
CREATE POLICY "public_read_active_screens" ON product_screens FOR SELECT
  TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admin_select_all_screens" ON product_screens;
CREATE POLICY "admin_select_all_screens" ON product_screens FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_product_screens" ON product_screens;
CREATE POLICY "admin_insert_product_screens" ON product_screens FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_product_screens" ON product_screens;
CREATE POLICY "admin_update_product_screens" ON product_screens FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_product_screens" ON product_screens;
CREATE POLICY "admin_delete_product_screens" ON product_screens FOR DELETE
  TO authenticated USING (is_admin());

-- product_screen_sections policies
DROP POLICY IF EXISTS "public_read_active_screen_sections" ON product_screen_sections;
CREATE POLICY "public_read_active_screen_sections" ON product_screen_sections FOR SELECT
  TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admin_select_all_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_select_all_screen_sections" ON product_screen_sections FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_insert_product_screen_sections" ON product_screen_sections FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_update_product_screen_sections" ON product_screen_sections FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_product_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_delete_product_screen_sections" ON product_screen_sections FOR DELETE
  TO authenticated USING (is_admin());
