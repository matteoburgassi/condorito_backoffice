/*
# Make data-driven screens multi-tenant (product-scoped)

## Summary
`product_screens` was created with a globally-unique `slug` and no product
reference, so every product would share one set of screens. This migration
scopes screens to a product:
- adds `product_id` (FK -> product_products, cascade delete),
- backfills existing rows to the default Condorito product when present,
- replaces the global unique on `slug` with a unique on `(product_id, slug)`.

`product_screen_sections` stays keyed only by `screen_id` (it inherits the
product through its parent screen), so no change is needed there.

## Notes
- Column is left NULLABLE to keep the migration safe when no matching product
  exists; the backoffice always sets it on create going forward.
- RLS policies are unchanged: public reads active rows, admins write / see all.
*/

ALTER TABLE product_screens
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES product_products(id) ON DELETE CASCADE;

-- Backfill any pre-existing rows to the default Condorito product.
UPDATE product_screens
SET product_id = (SELECT id FROM product_products WHERE slug = 'condorito-cl' LIMIT 1)
WHERE product_id IS NULL;

-- Swap the global slug unique for a per-product unique.
ALTER TABLE product_screens DROP CONSTRAINT IF EXISTS product_screens_slug_key;

DROP INDEX IF EXISTS product_screens_product_slug_key;
CREATE UNIQUE INDEX product_screens_product_slug_key
  ON product_screens (product_id, slug);

CREATE INDEX IF NOT EXISTS idx_product_screens_product
  ON product_screens (product_id);
