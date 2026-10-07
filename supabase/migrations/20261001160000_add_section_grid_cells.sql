/*
# Section-level desktop grid sizing

Moves gridCells out of widget config JSON so every section type, including
runtime-managed widgets, shares one validated layout field.
*/

ALTER TABLE product_screen_sections
  ADD COLUMN IF NOT EXISTS grid_cells smallint DEFAULT 12;

UPDATE product_screen_sections
SET
  grid_cells = CASE
    WHEN jsonb_typeof(config->'gridCells') = 'number'
      AND (config->>'gridCells')::numeric BETWEEN 1 AND 12
      AND (config->>'gridCells')::numeric = trunc((config->>'gridCells')::numeric)
      THEN (config->>'gridCells')::smallint
    ELSE COALESCE(grid_cells, 12)
  END,
  config = config - 'gridCells'
WHERE config ? 'gridCells';

UPDATE product_screen_sections
SET grid_cells = 12
WHERE grid_cells IS NULL OR grid_cells < 1 OR grid_cells > 12;

ALTER TABLE product_screen_sections
  ALTER COLUMN grid_cells SET DEFAULT 12,
  ALTER COLUMN grid_cells SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'product_screen_sections'::regclass
      AND conname = 'product_screen_sections_grid_cells_check'
  ) THEN
    ALTER TABLE product_screen_sections
      ADD CONSTRAINT product_screen_sections_grid_cells_check
      CHECK (grid_cells BETWEEN 1 AND 12);
  END IF;
END
$$;
