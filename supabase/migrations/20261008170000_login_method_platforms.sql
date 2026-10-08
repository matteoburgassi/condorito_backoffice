-- Backfill config.platforms for login methods (desktop + mobile web).
-- Missing platforms is treated as both-on by the backoffice; persist explicitly for clarity.
UPDATE public.product_login_methods
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
  'platforms',
  jsonb_build_object('desktop', true, 'mobile', true)
)
WHERE config->'platforms' IS NULL;
