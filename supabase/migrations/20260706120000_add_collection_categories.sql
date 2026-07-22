-- Collection categories for the Colecciones screen (mock catalog; replace via Supabase when real catalog is wired)
CREATE TABLE IF NOT EXISTS collection_categories (
  id text PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  background_color text NOT NULL,
  character_asset text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  action_route text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collection_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_collection_categories" ON collection_categories FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_collection_categories" ON collection_categories FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_collection_categories" ON collection_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_collection_categories" ON collection_categories FOR DELETE
  TO authenticated USING (true);

INSERT INTO collection_categories (id, title, subtitle, background_color, character_asset, sort_order, is_visible, action_route) VALUES
  ('serie-regular', 'SERIE REGULAR', 'desde 1955 hasta la actualidad', '#E91E8C', 'condorito-1', 1, true, '/colecciones/serie-regular'),
  ('condorito-gigante', 'CONDORITO GIGANTE', 'chistes de diversas épocas', '#1B2A4A', 'banner2-condorito', 2, true, '/colecciones/condorito-gigante'),
  ('ediciones-especiales', 'EDICIONES ESPECIALES', 'catalogados por título temático', '#1A8C7D', 'banner1-comic', 3, true, '/colecciones/ediciones-especiales'),
  ('clasicos-pepo', 'CLÁSICOS DE PEPO', 'catalogados por título temático', '#F5A623', 'character_condorito', 4, true, '/colecciones/clasicos-pepo'),
  ('chistes', 'CHISTES', 'Humor rápido en 1 minuto', '#FFDD00', 'banner1-chistes', 5, true, '/colecciones/chistes'),
  ('tira-del-dia', 'TIRA DEL DÍA', 'Humor rápido en 1 minuto', '#0D6B5C', 'condorito-1', 6, true, '/colecciones/tira-del-dia')
ON CONFLICT (id) DO NOTHING;

-- Colecciones screen translations
INSERT INTO product_translations (product_id, language_code, namespace, key, value)
SELECT p.id, 'es', 'colecciones', k.key, k.value
FROM product_products p
CROSS JOIN (VALUES
  ('titulo', 'COLECCIONES'),
  ('buscar', 'Busca en la colección...'),
  ('series', 'SERIES'),
  ('resultados', 'RESULTADOS'),
  ('sin_resultados', 'Sin resultados')
) AS k(key, value)
WHERE p.slug = 'condorito-cl'
ON CONFLICT (product_id, language_code, namespace, key) DO UPDATE SET value = EXCLUDED.value;
