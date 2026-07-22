DROP POLICY IF EXISTS "admin_select_all_screens" ON product_screens;
CREATE POLICY "admin_select_all_screens" ON product_screens FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_select_all_screen_sections" ON product_screen_sections;
CREATE POLICY "admin_select_all_screen_sections" ON product_screen_sections FOR SELECT
  TO authenticated USING (is_admin());