-- ============================================================
-- Keep user_profiles.challenges_entered in sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_challenges_entered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles
    SET challenges_entered = challenges_entered + 1
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles
    SET challenges_entered = GREATEST(0, challenges_entered - 1)
    WHERE id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_submission_change ON public.submissions;
CREATE TRIGGER on_submission_change
  AFTER INSERT OR DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_challenges_entered();

-- ============================================================
-- Keep user_profiles.podium_finishes in sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_podium_finishes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_is_podium boolean := false;
  new_is_podium boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_is_podium := (OLD.rank IS NOT NULL AND OLD.rank <= 3);
    IF old_is_podium THEN
      UPDATE public.user_profiles
      SET podium_finishes = GREATEST(0, podium_finishes - 1)
      WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    new_is_podium := (NEW.rank IS NOT NULL AND NEW.rank <= 3);
    IF new_is_podium THEN
      UPDATE public.user_profiles
      SET podium_finishes = podium_finishes + 1
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only adjust if podium status changed
  old_is_podium := (OLD.rank IS NOT NULL AND OLD.rank <= 3);
  new_is_podium := (NEW.rank IS NOT NULL AND NEW.rank <= 3);

  IF old_is_podium AND NOT new_is_podium THEN
    UPDATE public.user_profiles
    SET podium_finishes = GREATEST(0, podium_finishes - 1)
    WHERE id = NEW.user_id;
  ELSIF NOT old_is_podium AND new_is_podium THEN
    UPDATE public.user_profiles
    SET podium_finishes = podium_finishes + 1
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_rank_change ON public.submissions;
CREATE TRIGGER on_submission_rank_change
  AFTER INSERT OR UPDATE OF rank OR DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_podium_finishes();

-- ============================================================
-- Backfill current counts from existing data
-- ============================================================

UPDATE public.user_profiles u
SET
  challenges_entered = (
    SELECT count(*) FROM public.submissions s WHERE s.user_id = u.id
  ),
  podium_finishes = (
    SELECT count(*) FROM public.submissions s
    WHERE s.user_id = u.id AND s.rank IS NOT NULL AND s.rank <= 3
  );
