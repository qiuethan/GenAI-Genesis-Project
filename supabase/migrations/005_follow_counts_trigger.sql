-- ============================================================
-- Keep user_profiles.follower_count and following_count in sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE public.user_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.following_id;
    UPDATE public.user_profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_follows_change ON public.follows;
CREATE TRIGGER on_follows_change
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Backfill current counts (run once)
UPDATE public.user_profiles u
SET
  follower_count = (SELECT count(*) FROM public.follows f WHERE f.following_id = u.id),
  following_count = (SELECT count(*) FROM public.follows f WHERE f.follower_id = u.id);
