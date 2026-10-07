/*
# Desktop-specific screen sections

Adds a platform discriminator to screen sections. Existing rows remain mobile
so current layouts and older app versions keep their existing behaviour.
*/

ALTER TABLE product_screen_sections
  ADD COLUMN IF NOT EXISTS is_desktop boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_screen_sections_screen_platform_position
  ON product_screen_sections (screen_id, is_desktop, position);
