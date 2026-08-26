ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT ARRAY['orders']::text[],
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS push_subscriptions_topics_idx ON public.push_subscriptions USING gin (topics);
CREATE INDEX IF NOT EXISTS push_subscriptions_site_idx ON public.push_subscriptions (site_id);