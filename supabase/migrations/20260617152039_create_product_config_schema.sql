
-- Services (e.g. "condorito")
CREATE TABLE IF NOT EXISTS product_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Products (service + country combo)
CREATE TABLE IF NOT EXISTS product_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES product_services(id),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  country_code text NOT NULL,
  hostname text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz DEFAULT now()
);

-- Languages per product
CREATE TABLE IF NOT EXISTS product_languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  is_default boolean DEFAULT false,
  UNIQUE(product_id, code)
);

-- Branding per product
CREATE TABLE IF NOT EXISTS product_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  colors jsonb DEFAULT '{}',
  gradients jsonb DEFAULT '{}',
  fonts jsonb DEFAULT '{"body":"Inter","heading":"Inter"}',
  radius jsonb DEFAULT '{"sm":4,"md":8,"lg":16,"xl":24,"full":9999}',
  spacing jsonb DEFAULT '{"xxs":4,"xs":8,"sm":12,"md":16,"lg":24,"xl":32}',
  font_sizes jsonb DEFAULT '{"xs":10,"sm":12,"md":14,"lg":18,"xl":22}',
  font_weights jsonb DEFAULT '{"regular":"400","medium":"500","semibold":"600","bold":"700"}',
  shadows jsonb DEFAULT '{}',
  UNIQUE(product_id)
);

-- Assets per product
CREATE TABLE IF NOT EXISTS product_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  key text NOT NULL,
  url text NOT NULL,
  mime_type text DEFAULT 'image/png',
  metadata jsonb DEFAULT '{}',
  UNIQUE(product_id, key)
);

-- Translations per product + language
CREATE TABLE IF NOT EXISTS product_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  namespace text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  UNIQUE(product_id, language_code, namespace, key)
);

-- Config key-value pairs per product
CREATE TABLE IF NOT EXISTS product_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  UNIQUE(product_id, key)
);

-- Feature flags per product
CREATE TABLE IF NOT EXISTS product_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean DEFAULT false,
  UNIQUE(product_id, key)
);

-- Login methods per product
CREATE TABLE IF NOT EXISTS product_login_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  type text NOT NULL,
  enabled boolean DEFAULT true,
  is_default boolean DEFAULT false,
  "order" int DEFAULT 1,
  label_i18n_key text,
  icon text,
  allow_signup boolean DEFAULT true,
  feature_flag text,
  min_app_version text,
  max_app_version text,
  config jsonb DEFAULT '{}'
);

-- Menu items per product
CREATE TABLE IF NOT EXISTS product_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  label_i18n_key text,
  icon text NOT NULL DEFAULT 'home',
  icon_url text,
  route text NOT NULL DEFAULT '/',
  external_url text,
  position int NOT NULL DEFAULT 1,
  "order" int,
  auth_required boolean DEFAULT false,
  feature_flag text,
  min_app_version text,
  max_app_version text,
  badge_text text,
  badge_color text,
  visible boolean DEFAULT true,
  parent_key text,
  UNIQUE(product_id, key)
);

-- Menu item tier overrides
CREATE TABLE IF NOT EXISTS product_menu_item_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES product_menu_items(id) ON DELETE CASCADE,
  tier text NOT NULL,
  visible boolean DEFAULT true,
  enabled boolean DEFAULT true,
  locked_action text DEFAULT 'none',
  display_order int,
  route text,
  external_url text,
  label text,
  label_i18n_key text,
  badge_text text,
  badge_color text,
  "order" int,
  UNIQUE(menu_item_id, tier)
);

-- Footer items per product
CREATE TABLE IF NOT EXISTS product_footer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  icon text,
  position int NOT NULL DEFAULT 1,
  "group" text,
  UNIQUE(product_id, key)
);

-- Footer hidden pages per product
CREATE TABLE IF NOT EXISTS product_footer_hidden_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  path_prefix text NOT NULL
);

-- Documents per product
CREATE TABLE IF NOT EXISTS product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  slug text NOT NULL,
  path text NOT NULL,
  title text NOT NULL,
  version int DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, slug)
);

-- Document content (per locale)
CREATE TABLE IF NOT EXISTS product_document_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES product_documents(id) ON DELETE CASCADE,
  locale text NOT NULL,
  title text NOT NULL,
  body_html text NOT NULL,
  UNIQUE(document_id, locale)
);

-- Content consumption rules per product
CREATE TABLE IF NOT EXISTS product_consumption_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  max_per_day text,
  reset_hour_utc text DEFAULT '0',
  UNIQUE(product_id, content_type)
);

-- Unsub method per product
CREATE TABLE IF NOT EXISTS product_unsub_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_products(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'standard',
  confirm_unsubscription boolean DEFAULT true,
  permanent_delete_after_unsub boolean DEFAULT false,
  external_url text,
  external_link_target text DEFAULT 'browser',
  config jsonb DEFAULT '{}',
  UNIQUE(product_id)
);

-- RLS policies (these are admin-managed tables, read-only via anon key)
ALTER TABLE product_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_login_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_menu_item_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_footer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_footer_hidden_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_document_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_consumption_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_unsub_methods ENABLE ROW LEVEL SECURITY;

-- Public read access (product config is public data)
CREATE POLICY "allow_public_read" ON product_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_languages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_branding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_translations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_login_methods FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_menu_item_tiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_footer_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_footer_hidden_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_document_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_consumption_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "allow_public_read" ON product_unsub_methods FOR SELECT TO anon, authenticated USING (true);
