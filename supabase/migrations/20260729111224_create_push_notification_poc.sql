/*
# Push Notification POC - Tables

## Summary
Creates the database infrastructure for a push notification proof-of-concept:
a user_profiles table to track premium/free status, and a notifications table
to store sent notifications.

## New Tables

### user_profiles
- `id` (uuid, PK, references auth.users)
- `display_name` (text)
- `is_premium` (boolean, default false)
- `created_at` (timestamptz)

### notifications
- `id` (uuid, PK, auto-generated)
- `target_user_id` (uuid, nullable — null means broadcast to segment)
- `segment` (text — 'all', 'premium', 'free', or 'specific')
- `title` (text, not null)
- `body` (text)
- `is_read` (boolean, default false)
- `created_at` (timestamptz)
- `sent_by` (uuid, the admin who sent it)

## Security
- RLS enabled on both tables.
- user_profiles: users can read/update their own profile; admins (authenticated) can read all.
- notifications: users can read their own notifications; admins can insert.

## Important Notes
1. user_profiles uses auth.uid() as the id — ties directly to Supabase Auth.
2. notifications.target_user_id is nullable to support segment-based targeting.
3. For the POC, "admin" is anyone authenticated (no admin_users table needed on this project).
*/

-- 1. user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- 2. notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  segment text NOT NULL DEFAULT 'specific',
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_user
  ON notifications (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_segment
  ON notifications (segment, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read notifications targeted to them or to their segment
DROP POLICY IF EXISTS "users_read_own_notifications" ON notifications;
CREATE POLICY "users_read_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (
    target_user_id = auth.uid()
    OR (segment = 'all')
    OR (segment = 'premium' AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_premium = true
    ))
    OR (segment = 'free' AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_premium = false
    ))
  );

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- Any authenticated user can insert (for POC; in production restrict to admins)
DROP POLICY IF EXISTS "admin_insert_notifications" ON notifications;
CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- Any authenticated user can delete their own read notifications
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
CREATE POLICY "users_delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (target_user_id = auth.uid());
