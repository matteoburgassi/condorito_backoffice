-- Rename product slug Chile → Peru (same row / product_id; FKs unchanged).

UPDATE product_products
SET
  slug = 'condorito-pe',
  display_name = 'Condorito Peru',
  country_code = 'PE',
  environment = 'staging'
WHERE slug = 'condorito-cl';
