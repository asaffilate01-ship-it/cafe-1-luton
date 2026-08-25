CREATE OR REPLACE FUNCTION public.guard_profile_reward_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := (current_user IN ('postgres','supabase_admin','service_role','supabase_auth_admin'))
    OR (coalesce(auth.role(), '') = 'service_role');

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.loyalty_points := 0;
    NEW.lifetime_points := 0;
    NEW.drink_stamps := 0;
    NEW.free_drinks_available := 0;
    NEW.free_drinks_redeemed := 0;
  ELSE
    NEW.loyalty_points := OLD.loyalty_points;
    NEW.lifetime_points := OLD.lifetime_points;
    NEW.drink_stamps := OLD.drink_stamps;
    NEW.free_drinks_available := OLD.free_drinks_available;
    NEW.free_drinks_redeemed := OLD.free_drinks_redeemed;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_reward_columns_trg ON public.profiles;
CREATE TRIGGER guard_profile_reward_columns_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_reward_columns();