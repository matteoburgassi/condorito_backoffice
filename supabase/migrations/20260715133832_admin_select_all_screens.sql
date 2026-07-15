/*
# Admin full-visibility SELECT on data-driven screen tables

## Summary
The public SELECT policies on product_screens and product_screen_sections only
expose active rows (correct for the mobile app). The backoffice, however, must
be able to see INACTIVE screens and sections in order to toggle them back on.
This migration adds admin-only SELECT policies (via is_admin()) that return all
rows to admins, while the existing public policy continues to expose only active
rows to everyone else. Policies are permissive (OR'd), so the mobile app's
visibility is unchanged.

## Security changes
- Add "admin_select_all_screens" on product_screens: SELECT TO authenticated USING (is_admin()).
- Add "admin_select_all_screen_sections" on product_screen_sections: SELECT TO authenticated USING (is_admin()).
- No existing policy is modified; anon/public still only sees active rows.
*/

DROP POLICY IF EXISTS "admin_select_all_screens" ON product_screens;
CREATE POLICY "admin_select_all_screens" ON product_screens FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_select_all_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_select_all_screen_sections" ON product_screen_sections FOR SELECT
  TO authenticated USING (is_admin());
