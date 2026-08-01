
CREATE POLICY menu_images_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'menu-images');

CREATE POLICY menu_images_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY menu_images_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY menu_images_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
