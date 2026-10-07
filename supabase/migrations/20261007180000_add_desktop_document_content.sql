/*
# Desktop-specific document content

Adds a platform discriminator to legal document bodies. Existing rows remain
mobile so current apps keep their existing behaviour. Unique key becomes
(document_id, locale, is_desktop) so each locale can have a mobile and desktop body.
*/

ALTER TABLE product_document_content
  ADD COLUMN IF NOT EXISTS is_desktop boolean NOT NULL DEFAULT false;

ALTER TABLE product_document_content
  DROP CONSTRAINT IF EXISTS product_document_content_document_id_locale_key;

ALTER TABLE product_document_content
  ADD CONSTRAINT product_document_content_document_id_locale_platform_key
  UNIQUE (document_id, locale, is_desktop);

CREATE INDEX IF NOT EXISTS idx_document_content_document_platform
  ON product_document_content (document_id, is_desktop);
