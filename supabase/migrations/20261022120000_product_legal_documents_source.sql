/*
# Legal documents source per product

Adds product_products.legal_documents_source: CUSTOM (product_documents) or
ATOM (ATOM_PRODUCT_ID in product_config). Existing products stay CUSTOM.
Admins can update products so the backoffice can switch the source.
*/

ALTER TABLE product_products
  ADD COLUMN IF NOT EXISTS legal_documents_source text NOT NULL DEFAULT 'CUSTOM';

ALTER TABLE product_products
  DROP CONSTRAINT IF EXISTS product_products_legal_documents_source_check;

ALTER TABLE product_products
  ADD CONSTRAINT product_products_legal_documents_source_check
  CHECK (legal_documents_source IN ('CUSTOM', 'ATOM'));

DROP POLICY IF EXISTS admin_update_product_products ON product_products;

CREATE POLICY admin_update_product_products ON product_products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
