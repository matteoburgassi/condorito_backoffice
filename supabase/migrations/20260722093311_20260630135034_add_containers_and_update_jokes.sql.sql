-- Create containers table
CREATE TABLE IF NOT EXISTS containers (
  id text PRIMARY KEY,
  name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('comic', 'joke', 'condoricosa')),
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_containers" ON containers FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_containers" ON containers FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_containers" ON containers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_containers" ON containers FOR DELETE
  TO authenticated USING (true);

-- Add columns to jokes table
ALTER TABLE jokes ADD COLUMN IF NOT EXISTS container_id text REFERENCES containers(id);
ALTER TABLE jokes ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE jokes ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE jokes ADD COLUMN IF NOT EXISTS edition_number integer NOT NULL DEFAULT 1;

-- Seed containers with known data
INSERT INTO containers (id, name, content_type, sort_order, is_visible) VALUES
  ('4113997', 'Lo Mejor de la Semana', 'comic', 1, true),
  ('jokes-condoricosas', 'Condoricosas', 'joke', 2, true)
ON CONFLICT (id) DO NOTHING;

-- Update existing joke seed data with edition numbers
UPDATE jokes SET edition_number = 1 WHERE id = 'c3000001-0000-0000-0000-000000000001';
UPDATE jokes SET edition_number = 2 WHERE id = 'c3000001-0000-0000-0000-000000000002';
UPDATE jokes SET edition_number = 3 WHERE id = 'c3000001-0000-0000-0000-000000000003';
UPDATE jokes SET edition_number = 4 WHERE id = 'c3000001-0000-0000-0000-000000000004';
UPDATE jokes SET edition_number = 5 WHERE id = 'c3000001-0000-0000-0000-000000000005';

-- Add a real joke with Galaxy PDF
INSERT INTO jokes (id, image_url, text_content, is_free, container_id, pdf_url, edition_number, created_at) VALUES
  ('c3000001-0000-0000-0000-000000000010', '', 'Condoricosa N 42', true, 'jokes-condoricosas', 'https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf', 42, now())
ON CONFLICT (id) DO NOTHING;

-- Set container_id on existing jokes
UPDATE jokes SET container_id = 'jokes-condoricosas' WHERE container_id IS NULL;
