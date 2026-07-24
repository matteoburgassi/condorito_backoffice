/*
# Add stable character artwork slugs

Character detail sheets resolve bundled mobile artwork by this stable key.
The column and partial unique index mirror the Condorito application schema.
*/

ALTER TABLE characters ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS characters_slug_key
  ON characters (slug)
  WHERE slug IS NOT NULL;
