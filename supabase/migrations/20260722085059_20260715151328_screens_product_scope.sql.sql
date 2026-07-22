-- Add product_id column without FK constraint since product_products table
-- does not exist yet. The FK can be added later once product_products is created.
ALTER TABLE product_screens
  ADD COLUMN IF NOT EXISTS product_id uuid;

-- Swap the global slug unique for a per-product unique.
ALTER TABLE product_screens DROP CONSTRAINT IF EXISTS product_screens_slug_key;

DROP INDEX IF EXISTS product_screens_product_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS product_screens_product_slug_key
  ON product_screens (product_id, slug);

CREATE INDEX IF NOT EXISTS idx_product_screens_product
  ON product_screens (product_id);