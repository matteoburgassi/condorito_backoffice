/*
# Complete schema: admin-gated policies, missing columns, product seed, screen FK

## Summary
This migration completes the database schema by doing three things that the
earlier backoffice migrations could not do because the main schema tables
did not exist yet:

1. Applies admin-gated INSERT/UPDATE/DELETE policies to all 22 managed content
   and config tables (the managed-tables block that was skipped in the original
   backoffice migration). Pre-existing permissive write policies on containers
   and collection_categories are dropped first so non-admin authenticated users
   cannot write.

2. Adds columns the backoffice UI references that were never created:
   - comics: thumbnail_url, pdf_url, container_id
   - comic_strips: preview_aspect_ratio, pdf_url
   - collection_categories: cms_id

3. Seeds the default product_services + product_products rows that
   ProductContext.tsx and the banner seed migration depend on, and adds the
   FK constraint from product_screens.product_id to product_products.id (the
   column was added earlier without the FK because the table didn't exist).

## Modified Tables

### comics
- thumbnail_url (text, default ''): small preview image URL.
- pdf_url (text, default ''): link to full-issue PDF.
- container_id (text, FK -> containers(id), nullable): groups comics into a
  content container.

### comic_strips
- preview_aspect_ratio (double precision, default 1): aspect ratio for previews.
- pdf_url (text, default ''): link to strip PDF.

### collection_categories
- cms_id (text, nullable): catalog CMS id used as detail route param and comics
  container_id.

### product_screens
- product_id FK constraint added (column already existed without FK).

## Security
Admin-gated policies added to all managed tables. is_admin() function (created
by the backoffice migration) gates all writes to authenticated admins only.
Public SELECT policies remain unchanged.

## Important Notes
1. All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
2. container_id on comics is intentionally nullable.
3. The managed-tables loop drops and recreates admin_* policies to stay
   idempotent across re-runs.
*/

-- 1. Admin-gated write policies on managed tables ---------------------------
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
    'product_documents','product_document_content',
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

-- 2. Missing columns --------------------------------------------------------

-- comics: missing columns
ALTER TABLE comics ADD COLUMN IF NOT EXISTS thumbnail_url text NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS pdf_url text NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS container_id text REFERENCES containers(id);

-- comic_strips: missing columns
ALTER TABLE comic_strips ADD COLUMN IF NOT EXISTS preview_aspect_ratio double precision NOT NULL DEFAULT 1;
ALTER TABLE comic_strips ADD COLUMN IF NOT EXISTS pdf_url text NOT NULL DEFAULT '';

-- collection_categories: missing column
ALTER TABLE collection_categories ADD COLUMN IF NOT EXISTS cms_id text;

-- 3. Seed default service + product + screen FK ------------------------------

INSERT INTO product_services (slug, display_name)
VALUES ('condorito', 'Condorito')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_products (service_id, slug, display_name, country_code, environment)
SELECT s.id, 'condorito-cl', 'Condorito Chile', 'CL', 'production'
FROM product_services s
WHERE s.slug = 'condorito'
ON CONFLICT (slug) DO NOTHING;

-- Backfill product_screens.product_id now that product_products exists
UPDATE product_screens
SET product_id = (SELECT id FROM product_products WHERE slug = 'condorito-cl' LIMIT 1)
WHERE product_id IS NULL;

-- Add FK constraint on product_screens.product_id (column existed without FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_screens'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'product_screens_product_id_fkey'
  ) THEN
    ALTER TABLE product_screens
      ADD CONSTRAINT product_screens_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES product_products(id) ON DELETE CASCADE;
  END IF;
END $$;
