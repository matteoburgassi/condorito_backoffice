/*
# Condorito App — Initial Schema

## Summary
Creates all core tables for the Condorito comic app: comics, comic strips with panels,
jokes, characters, games, and user profiles with subscription state.

## New Tables

### comics
Stores individual comic issues available in the collection.
- id: UUID primary key
- title: Comic title (e.g. "Condorito #1")
- issue_number: Issue number for display and sorting
- year: Publication year
- cover_image_url: URL of the cover image
- description: Short description of the issue
- is_premium: Whether this comic requires a subscription
- cms_id: Reserved for future CMS integration

### comic_strips
Stores individual tira (strip) entries, each containing an ordered set of panels.
- id: UUID primary key
- title: Strip title
- panels: JSONB array of {order, image_url} objects
- published_date: Date of publication
- is_free: Whether this strip is freely accessible

### jokes
Stores chiste (joke) entries, optionally with an image and text.
- id: UUID primary key
- image_url: Image representing the joke
- text_content: Optional text caption
- is_free: Whether freely accessible

### characters
Stores Condorito universe characters with bios.
- id: UUID primary key
- name: Character name
- description: Short tagline
- avatar_image_url: Portrait image URL
- bio: Full biography text
- sort_order: Display order

### games
Stores external HTML5 games launchable in the in-app webview.
- id: UUID primary key
- title: Game title
- cover_image_url: Preview image
- game_url: External HTML5 game URL
- description: Short description

### profiles
Stores per-user subscription state, linked to Supabase auth.users.
- id: UUID primary key, matches auth.users.id
- subscription_plan: none | monthly | annual
- subscription_status: active | expired | cancelled | null
- subscription_started_at: When the subscription began
- subscription_expires_at: When the subscription expires

## Security
- RLS enabled on all tables.
- comics, comic_strips, jokes, characters, games: publicly readable by anon + authenticated.
- profiles: owner-scoped (authenticated only, user can only read/write their own row).
*/

-- comics
CREATE TABLE IF NOT EXISTS comics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  issue_number integer NOT NULL DEFAULT 1,
  year integer NOT NULL DEFAULT 2024,
  cover_image_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_premium boolean NOT NULL DEFAULT false,
  cms_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_comics" ON comics;
CREATE POLICY "anon_read_comics" ON comics FOR SELECT TO anon, authenticated USING (true);

-- comic_strips
CREATE TABLE IF NOT EXISTS comic_strips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  panels jsonb NOT NULL DEFAULT '[]',
  published_date date NOT NULL DEFAULT CURRENT_DATE,
  is_free boolean NOT NULL DEFAULT true,
  cms_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comic_strips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_comic_strips" ON comic_strips;
CREATE POLICY "anon_read_comic_strips" ON comic_strips FOR SELECT TO anon, authenticated USING (true);

-- jokes
CREATE TABLE IF NOT EXISTS jokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL DEFAULT '',
  text_content text NOT NULL DEFAULT '',
  is_free boolean NOT NULL DEFAULT true,
  cms_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jokes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_jokes" ON jokes;
CREATE POLICY "anon_read_jokes" ON jokes FOR SELECT TO anon, authenticated USING (true);

-- characters
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  avatar_image_url text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_characters" ON characters;
CREATE POLICY "anon_read_characters" ON characters FOR SELECT TO anon, authenticated USING (true);

-- games
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_image_url text NOT NULL DEFAULT '',
  game_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_games" ON games;
CREATE POLICY "anon_read_games" ON games FOR SELECT TO anon, authenticated USING (true);

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_plan text NOT NULL DEFAULT 'none' CHECK (subscription_plan IN ('none', 'monthly', 'annual')),
  subscription_status text CHECK (subscription_status IN ('active', 'expired', 'cancelled')),
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);
