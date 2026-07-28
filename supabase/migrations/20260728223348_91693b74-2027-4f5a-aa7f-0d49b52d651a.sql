DROP POLICY "public read published posts" ON public.blog_posts;
CREATE POLICY "anon read published posts" ON public.blog_posts FOR SELECT TO anon USING (published = true);
CREATE POLICY "authed read posts" ON public.blog_posts FOR SELECT TO authenticated USING (published = true OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
GRANT SELECT ON public.blog_posts TO anon, authenticated;