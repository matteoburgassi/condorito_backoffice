-- Web MSISDN login without PIN (operator header enrichment / number recognition).
-- Disabled by default; enable per product from the Login Methods page.
-- App support for this type is separate; this only exposes the method in config.

INSERT INTO product_login_methods (
  product_id,
  type,
  enabled,
  is_default,
  "order",
  allow_signup,
  config
)
SELECT
  p.id,
  'msisdn_no_pin',
  false,
  false,
  COALESCE((SELECT MAX(m."order") FROM product_login_methods m WHERE m.product_id = p.id), 0) + 1,
  false,
  '{"surface":"web","identifier_kind":"msisdn"}'::jsonb
FROM product_products p
WHERE NOT EXISTS (
  SELECT 1
  FROM product_login_methods existing
  WHERE existing.product_id = p.id
    AND existing.type = 'msisdn_no_pin'
);
