-- ============================================================
-- Seed current user profile: followers, following, podiums
-- ============================================================
-- Targets the profile with username 'William' (case-insensitive).
-- - Inserts mutual follows with other existing users (up to 5).
-- - Assigns podium ranks (1st, 2nd, 3rd) to your submissions
--   (one per challenge, up to 3 challenges) and updates profile stats.
-- Safe to run multiple times (uses ON CONFLICT / idempotent updates).
-- ============================================================

DO $$
DECLARE
  william_id uuid;
  other_id uuid;
  sub_rec record;
  r int := 1;
BEGIN
  -- Resolve "William" profile (first match by username)
  SELECT id INTO william_id
  FROM public.user_profiles
  WHERE username ILIKE 'william'
  LIMIT 1;

  IF william_id IS NULL THEN
    RETURN;
  END IF;

  -- 1) Followers / Following: mutual follows with every other existing user (max 5)
  FOR other_id IN
    SELECT id FROM public.user_profiles
    WHERE id != william_id
    LIMIT 5
  LOOP
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (william_id, other_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (other_id, william_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
  END LOOP;

  -- 2) Podiums: assign rank 1, 2, 3 (and score) to one submission per challenge for William
  FOR sub_rec IN
    SELECT sub.id AS sub_id, (1.0 - (sub.ord * 0.05))::float AS score_val
    FROM (
      SELECT id, row_number() OVER (ORDER BY submitted_at DESC) AS ord
      FROM (
        SELECT DISTINCT ON (challenge_id) id, submitted_at
        FROM public.submissions
        WHERE user_id = william_id
        ORDER BY challenge_id, submitted_at DESC
      ) one_per_challenge
    ) sub
    WHERE sub.ord <= 3
  LOOP
    UPDATE public.submissions
    SET rank = r, score = sub_rec.score_val
    WHERE id = sub_rec.sub_id;
    r := r + 1;
  END LOOP;

  -- 3) Update user_profiles stats for William
  UPDATE public.user_profiles u
  SET
    challenges_entered = (SELECT count(*) FROM public.submissions WHERE user_id = william_id),
    podium_finishes = (SELECT count(*) FROM public.submissions WHERE user_id = william_id AND rank IS NOT NULL AND rank <= 3),
    best_rank = (SELECT min(rank) FROM public.submissions WHERE user_id = william_id AND rank IS NOT NULL),
    avg_score = (SELECT avg(score) FROM public.submissions WHERE user_id = william_id AND score IS NOT NULL),
    updated_at = now()
  WHERE u.id = william_id;

END $$;
