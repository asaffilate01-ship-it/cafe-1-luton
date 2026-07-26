
UPDATE public.business_hours SET closed = true WHERE day_of_week IN (0, 6);

CREATE TABLE IF NOT EXISTS public.bank_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bank_holidays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bank_holidays TO authenticated;
GRANT ALL ON public.bank_holidays TO service_role;

ALTER TABLE public.bank_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bank holidays" ON public.bank_holidays FOR SELECT USING (true);
CREATE POLICY "Staff can manage bank holidays" ON public.bank_holidays FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

INSERT INTO public.bank_holidays (holiday_date, name) VALUES
  ('2026-01-01','New Year''s Day'),
  ('2026-04-03','Good Friday'),
  ('2026-04-06','Easter Monday'),
  ('2026-05-04','Early May bank holiday'),
  ('2026-05-25','Spring bank holiday'),
  ('2026-08-31','Summer bank holiday'),
  ('2026-12-25','Christmas Day'),
  ('2026-12-28','Boxing Day (substitute)'),
  ('2027-01-01','New Year''s Day')
ON CONFLICT (holiday_date) DO NOTHING;
