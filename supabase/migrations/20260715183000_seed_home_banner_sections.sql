/*
# Seed home banner sections (Area Libre + Subscribe)

Adds the two standard home banners as backoffice-managed sections when missing.
They use config.audience so the app shows them only to the right viewers:
  - home_area_libre → guest (anonymous / not logged in)
  - suscribete_banner → non_premium (guests + logged-in free users)

Only runs when a `home` screen already exists for condorito-cl (or creates one
if none). Reorder sections in the backoffice after apply if needed.
*/

DO $$
DECLARE
  pid uuid;
  sid uuid;
  tira_pos int;
  footer_pos int;
  area_config jsonb := '{
    "key": "home_area_libre",
    "audience": "guest",
    "variant": "columns",
    "backgroundColor": "#007DBD",
    "assets": { "pattern": "pattern_banner", "character": "condorito-1" },
    "i18n": {
      "title": "home.area_libre",
      "subtitle": "home.comic",
      "subtitle2": "home.chistes",
      "ctaLabel": "home.lee_gratis"
    },
    "title": "Area Libre",
    "subtitle": "Comic",
    "subtitle2": "Chistes",
    "ctaLabel": "Lee Todo Gratis",
    "ctaAction": { "type": "navigate", "route": "/freemium" }
  }'::jsonb;
  sub_config jsonb := '{
    "key": "suscribete_banner",
    "audience": "non_premium",
    "variant": "subscription",
    "backgroundColor": "#E85D9F",
    "assets": {
      "pattern": "pattern_banner2",
      "character": "banner2-condorito",
      "topImage": "subscribe-banner-comics"
    },
    "i18n": {
      "title": "home.suscribete_banner_title",
      "subtitle": "home.suscribete_banner_subtitle",
      "ctaLabel": "home.suscribete_btn"
    },
    "title": "¡Accede a toda la colección de cómics de Condorito!",
    "subtitle": "Suscríbete y lee sin límites",
    "ctaLabel": "Suscríbete Ahora",
    "ctaAction": { "type": "show_subscription" }
  }'::jsonb;
BEGIN
  SELECT id INTO pid FROM product_products WHERE slug = 'condorito-cl' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'condorito-cl product not found; skipping banner seed';
    RETURN;
  END IF;

  SELECT id INTO sid FROM product_screens WHERE product_id = pid AND slug = 'home' LIMIT 1;
  IF sid IS NULL THEN
    RAISE NOTICE 'No home screen in backoffice; compose home in Screens and use Banner presets';
    RETURN;
  END IF;

  IF (SELECT count(*)::int FROM product_screen_sections WHERE screen_id = sid) = 0 THEN
    RAISE NOTICE 'Home screen has no sections yet; add sections in backoffice before seeding banners';
    RETURN;
  END IF;

  SELECT position INTO tira_pos
  FROM product_screen_sections
  WHERE screen_id = sid AND (config->>'key' = 'tira_del_dia' OR type = 'inline-pdf')
  ORDER BY position
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM product_screen_sections
    WHERE screen_id = sid AND config->>'key' = 'home_area_libre'
  ) THEN
    INSERT INTO product_screen_sections (screen_id, position, type, config, is_active)
    VALUES (sid, COALESCE(tira_pos, 0) + 1, 'banner', area_config, true);
  END IF;

  SELECT position INTO footer_pos
  FROM product_screen_sections
  WHERE screen_id = sid AND type = 'footer'
  ORDER BY position
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM product_screen_sections
    WHERE screen_id = sid AND config->>'key' = 'suscribete_banner'
  ) THEN
    INSERT INTO product_screen_sections (screen_id, position, type, config, is_active)
    VALUES (
      sid,
      CASE WHEN footer_pos IS NOT NULL THEN GREATEST(footer_pos - 1, 0) ELSE 900 END,
      'banner',
      sub_config,
      true
    );
  END IF;
END $$;
