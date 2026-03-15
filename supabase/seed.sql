-- ============================================================
-- UNIFIED SEED SCRIPT
-- Seeds the entire database with mock data.
-- Run in Supabase SQL Editor. Safe to run multiple times.
--
-- PREREQUISITE: Upload the 12 photos to the 'submissions' bucket
-- under the path: submissions/isaac/{filename}
-- e.g. submissions/isaac/DSCF3714.jpg
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CLEAN UP: Remove all previous seed data
-- ============================================================
DELETE FROM public.reactions;
DELETE FROM public.comments;
DELETE FROM public.saved_posts;
DELETE FROM public.submissions;
DELETE FROM public.follows;
DELETE FROM public.challenges WHERE title LIKE 'Seed:%';

-- Remove seed auth users (cascade deletes their profiles)
DELETE FROM auth.users WHERE id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000007'
);

-- ============================================================
-- 2. CREATE MOCK AUTH USERS
-- ============================================================
DO $$
DECLARE
  _users jsonb := '[
    {"id": "b0000000-0000-0000-0000-000000000001", "email": "alice@frame.test",   "username": "alice_frames",   "display_name": "Alice Chen"},
    {"id": "b0000000-0000-0000-0000-000000000002", "email": "bob@frame.test",     "username": "bob_shoots",     "display_name": "Bob Martinez"},
    {"id": "b0000000-0000-0000-0000-000000000003", "email": "chris@frame.test",   "username": "chris_clicks",   "display_name": "Chris Park"},
    {"id": "b0000000-0000-0000-0000-000000000004", "email": "dana@frame.test",    "username": "dana_captures",  "display_name": "Dana Rivera"},
    {"id": "b0000000-0000-0000-0000-000000000005", "email": "emma@frame.test",    "username": "emma_lens",      "display_name": "Emma Liu"},
    {"id": "b0000000-0000-0000-0000-000000000006", "email": "frank@frame.test",   "username": "frank_focus",    "display_name": "Frank Kim"},
    {"id": "b0000000-0000-0000-0000-000000000007", "email": "isaac@frame.test",   "username": "isaac_peciov",   "display_name": "Isaac Peciov"}
  ]';
  _u jsonb;
BEGIN
  FOR _u IN SELECT * FROM jsonb_array_elements(_users)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = (_u->>'id')::uuid) THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token
      ) VALUES (
        (_u->>'id')::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        _u->>'email',
        crypt('testpass123', gen_salt('bf')),
        now(),
        jsonb_build_object('username', _u->>'username', 'display_name', _u->>'display_name'),
        now(), now(), '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        (_u->>'id')::uuid,
        _u->>'email',
        jsonb_build_object('sub', _u->>'id', 'email', _u->>'email'),
        'email',
        now(), now(), now()
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 3. UPDATE USER PROFILES
-- ============================================================
UPDATE public.user_profiles SET
  display_name = 'Alice Chen',
  bio = 'Street photographer. Always chasing golden hour.',
  composition_badge = 'Rule of Thirds',
  challenges_entered = 5, podium_finishes = 2, best_rank = 1, avg_score = 0.85
WHERE id = 'b0000000-0000-0000-0000-000000000001';

UPDATE public.user_profiles SET
  display_name = 'Bob Martinez',
  bio = 'Landscape & nature lover.',
  composition_badge = 'Center',
  challenges_entered = 3, podium_finishes = 1, best_rank = 2, avg_score = 0.78
WHERE id = 'b0000000-0000-0000-0000-000000000002';

UPDATE public.user_profiles SET
  display_name = 'Chris Park',
  bio = 'Minimalist photographer based in Seoul.',
  composition_badge = 'Symmetric',
  challenges_entered = 4, podium_finishes = 1, best_rank = 3, avg_score = 0.72
WHERE id = 'b0000000-0000-0000-0000-000000000003';

UPDATE public.user_profiles SET
  display_name = 'Dana Rivera',
  bio = 'I see patterns everywhere.',
  composition_badge = 'Pattern',
  challenges_entered = 6, podium_finishes = 3, best_rank = 1, avg_score = 0.88
WHERE id = 'b0000000-0000-0000-0000-000000000004';

UPDATE public.user_profiles SET
  display_name = 'Emma Liu',
  bio = 'Architecture & urban geometry.',
  challenges_entered = 2, podium_finishes = 0, avg_score = 0.65
WHERE id = 'b0000000-0000-0000-0000-000000000005';

UPDATE public.user_profiles SET
  display_name = 'Frank Kim',
  bio = 'Film photography enthusiast.',
  composition_badge = 'Golden Ratio',
  challenges_entered = 4, podium_finishes = 2, best_rank = 1, avg_score = 0.82
WHERE id = 'b0000000-0000-0000-0000-000000000006';

UPDATE public.user_profiles SET
  display_name = 'Isaac Peciov',
  bio = 'Cars, temples, and everything between. Fujifilm shooter.',
  composition_badge = 'Vanishing Point',
  challenges_entered = 12, podium_finishes = 6, best_rank = 1, avg_score = 0.89
WHERE id = 'b0000000-0000-0000-0000-000000000007';

-- ============================================================
-- 4. SEED CHALLENGES (one per composition type used by Isaac's photos)
-- ============================================================
INSERT INTO public.challenges (
  id, title, composition_type, description,
  cover_image_url, starts_at, submissions_close_at, status
) VALUES
  -- ACTIVE challenges
  ('a0000000-0000-0000-0000-000000000001',
   'Seed: Diagonal Lines',
   'diagonal',
   'Use diagonal lines to create dynamic energy and movement in your frame.',
   NULL, now() - interval '1 day', now() + interval '1 day', 'ACTIVE'),

  ('a0000000-0000-0000-0000-000000000002',
   'Seed: Center Composition',
   'center',
   'Focus the viewer by placing your main subject dead center.',
   NULL, now() - interval '12 hours', now() + interval '36 hours', 'ACTIVE'),

  ('a0000000-0000-0000-0000-000000000003',
   'Seed: Horizontal Flow',
   'horizontal',
   'Emphasize horizontal lines for a sense of calm, stability, or motion.',
   NULL, now() - interval '6 hours', now() + interval '42 hours', 'ACTIVE'),

  -- CLOSED challenges (past)
  ('a0000000-0000-0000-0000-000000000004',
   'Seed: Curved Lines',
   'curved',
   'Find curves in architecture, nature, or everyday objects.',
   NULL, now() - interval '10 days', now() - interval '9 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000005',
   'Seed: Vanishing Point',
   'vanishing_point',
   'Use converging lines to draw the eye toward a single point in the distance.',
   NULL, now() - interval '8 days', now() - interval '7 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000006',
   'Seed: Rule of Thirds',
   'rule_of_thirds',
   'Place your subject along the grid lines or at intersections.',
   NULL, now() - interval '6 days', now() - interval '5 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000007',
   'Seed: Pattern',
   'pattern',
   'Find repeating elements that create visual rhythm.',
   NULL, now() - interval '14 days', now() - interval '13 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000008',
   'Seed: Symmetry',
   'symmetric',
   'Find or create symmetry for a calm, balanced composition.',
   NULL, now() - interval '12 days', now() - interval '11 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000009',
   'Seed: Fill the Frame',
   'fill_the_frame',
   'Get close and let your subject dominate the entire frame.',
   NULL, now() - interval '16 days', now() - interval '15 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000010',
   'Seed: Golden Ratio',
   'golden_ratio',
   'Position your subject at the golden spiral''s focal point.',
   NULL, now() - interval '18 days', now() - interval '17 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000011',
   'Seed: Triangle Composition',
   'triangle',
   'Arrange elements to form triangular shapes for strength and stability.',
   NULL, now() - interval '20 days', now() - interval '19 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000012',
   'Seed: Radial Burst',
   'radial',
   'Capture elements radiating outward from a central point.',
   NULL, now() - interval '22 days', now() - interval '21 days', 'CLOSED')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  submissions_close_at = EXCLUDED.submissions_close_at;

-- ============================================================
-- 5. SEED ISAAC'S SUBMISSIONS (12 photos from storage bucket)
--    Photos uploaded directly to: submissions/{filename}
--    Public URL: https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/{filename}
-- ============================================================

-- Isaac's user ID
-- b0000000-0000-0000-0000-000000000007

INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- 1. Yellow Lamborghini Huracan - diagonal lines from car body
  ('a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF3714.jpg',
   'DSCF3714.jpg',
   'Neon yellow cutting through the crowd',
   'diagonal', 0.93, 1, now() - interval '20 hours'),

  -- 2. Bugatti Veyron front - center composition
  ('a0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF3749.jpg',
   'DSCF3749.jpg',
   'The horseshoe grille demands center stage',
   'center', 0.91, 1, now() - interval '10 hours'),

  -- 3. Yellow Ferrari F355 with motion blur - horizontal
  ('a0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF3781.jpg',
   'DSCF3781.jpg',
   'Time bends around a classic F355',
   'horizontal', 0.90, NULL, now() - interval '4 hours'),

  -- 4. Spiral staircase against blue sky - curved
  ('a0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF5783.jpg',
   'DSCF5783.jpg',
   'Concrete curves against endless blue',
   'curved', 0.94, 1, now() - interval '10 days'),

  -- 5. Fushimi Inari torii gate stairs - vanishing point
  ('a0000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6373.jpg',
   'DSCF6373.jpg',
   'A thousand gates, one destination',
   'vanishing_point', 0.95, 1, now() - interval '8 days'),

  -- 6. Torii gates from above with rooftops - rule of thirds
  ('a0000000-0000-0000-0000-000000000006',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6378.jpg',
   'DSCF6378.jpg',
   'Vermillion threads through the canopy',
   'rule_of_thirds', 0.88, 1, now() - interval '6 days'),

  -- 7. Fox ema plaques with pigeon - pattern
  ('a0000000-0000-0000-0000-000000000007',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6386.jpg',
   'DSCF6386.jpg',
   'Foxes watching over an uninvited guest',
   'pattern', 0.92, 1, now() - interval '14 days'),

  -- 8. Orange hazy torii gate light leak - radial (light radiates from center)
  ('a0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6420.jpg',
   'DSCF6420.jpg',
   'When the light finds the gate',
   'radial', 0.86, 1, now() - interval '22 days'),

  -- 9. Red torii tunnel at night - symmetric
  ('a0000000-0000-0000-0000-000000000008',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6446.jpg',
   'DSCF6446.jpg',
   'Symmetry written in kanji and vermillion',
   'symmetric', 0.93, 1, now() - interval '12 days'),

  -- 10. Deer portrait close-up - fill the frame
  ('a0000000-0000-0000-0000-000000000009',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6469.jpg',
   'DSCF6469.jpg',
   'The king of Nara Park',
   'fill_the_frame', 0.91, 1, now() - interval '16 days'),

  -- 11. Young deer walking on grass - golden ratio
  ('a0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6481.jpg',
   'DSCF6481.jpg',
   'Spotted fawn at the golden spiral',
   'golden_ratio', 0.87, 1, now() - interval '18 days'),

  -- 12. Tokyo Tower cityscape double exposure - triangle
  ('a0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/DSCF6843.jpg',
   'DSCF6843.jpg',
   'Tokyo Tower rising through a ghost layer',
   'triangle', 0.89, 1, now() - interval '20 days');

-- ============================================================
-- 6. SEED OTHER USERS' SUBMISSIONS (spread across challenges)
-- ============================================================
INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- Diagonal challenge
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1015/1000/1000', 'mock/alice/1.jpg',
   'Lines leading nowhere', 'diagonal', 0.85, 2, now() - interval '18 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1035/1000/1000', 'mock/dana/1.jpg',
   'Diagonal shadows', 'diagonal', 0.82, 3, now() - interval '14 hours'),

  -- Center challenge
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/1018/1000/1000', 'mock/bob/1.jpg',
   'Mountain center piece', 'center', 0.84, 2, now() - interval '9 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/1025/1000/1000', 'mock/chris/1.jpg',
   'Centered minimalism', 'center', 0.79, 3, now() - interval '7 hours'),

  -- Vanishing Point (closed)
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1040/1000/1000', 'mock/dana/2.jpg',
   'Rail lines converge', 'vanishing_point', 0.86, 2, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1080/1000/1000', 'mock/frank/1.jpg',
   'Hallway perspective', 'vanishing_point', 0.80, 3, now() - interval '8 days'),

  -- Symmetry (closed)
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/164/1000/1000', 'mock/chris/2.jpg',
   'Perfect reflection', 'symmetric', 0.88, 2, now() - interval '12 days'),
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/260/1000/1000', 'mock/emma/1.jpg',
   'Building facade', 'symmetric', 0.70, 3, now() - interval '11 days'),

  -- Fill the Frame (closed)
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1074/1000/1000', 'mock/alice/2.jpg',
   'Texture close-up', 'fill_the_frame', 0.87, 2, now() - interval '16 days'),
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/119/1000/1000', 'mock/frank/2.jpg',
   'Eyes tell stories', 'fill_the_frame', 0.82, 3, now() - interval '16 days');

-- ============================================================
-- 7. UPDATE CHALLENGE COUNTS
-- ============================================================
UPDATE public.challenges SET
  submission_count = (SELECT count(*) FROM public.submissions WHERE challenge_id = challenges.id),
  participant_count = (SELECT count(DISTINCT user_id) FROM public.submissions WHERE challenge_id = challenges.id);

-- ============================================================
-- 8. SEED FOLLOWS
-- ============================================================
INSERT INTO public.follows (follower_id, following_id) VALUES
  -- Everyone follows Isaac
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000007'),
  -- Isaac follows a few back
  ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000006'),
  -- Other mutual follows
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Update follower/following counts
UPDATE public.user_profiles SET
  follower_count = (SELECT count(*) FROM public.follows WHERE following_id = user_profiles.id),
  following_count = (SELECT count(*) FROM public.follows WHERE follower_id = user_profiles.id);

-- ============================================================
-- 9. SEED REACTIONS (followers react to high-scoring submissions)
-- ============================================================
INSERT INTO public.reactions (submission_id, user_id)
SELECT s.id, f.follower_id
FROM public.submissions s
JOIN public.follows f ON f.following_id = s.user_id
WHERE s.score > 0.8
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. SEED WILLIAM'S PROFILE (mutual follows + podiums)
-- ============================================================
DO $$
DECLARE
  william_id uuid;
  other_id uuid;
  sub_rec record;
  r int := 1;
BEGIN
  SELECT id INTO william_id
  FROM public.user_profiles
  WHERE username ILIKE 'william'
  LIMIT 1;

  IF william_id IS NULL THEN
    RETURN;
  END IF;

  -- Mutual follows with all seed users
  FOR other_id IN
    SELECT id FROM public.user_profiles
    WHERE id != william_id
      AND id IN (
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000004',
        'b0000000-0000-0000-0000-000000000005',
        'b0000000-0000-0000-0000-000000000006',
        'b0000000-0000-0000-0000-000000000007'
      )
  LOOP
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (william_id, other_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (other_id, william_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Assign podium ranks to William's submissions
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

  -- Update William's profile stats
  UPDATE public.user_profiles
  SET
    challenges_entered = (SELECT count(*) FROM public.submissions WHERE user_id = william_id),
    podium_finishes = (SELECT count(*) FROM public.submissions WHERE user_id = william_id AND rank IS NOT NULL AND rank <= 3),
    best_rank = (SELECT min(rank) FROM public.submissions WHERE user_id = william_id AND rank IS NOT NULL),
    avg_score = (SELECT avg(score) FROM public.submissions WHERE user_id = william_id AND score IS NOT NULL),
    follower_count = (SELECT count(*) FROM public.follows WHERE following_id = william_id),
    following_count = (SELECT count(*) FROM public.follows WHERE follower_id = william_id),
    updated_at = now()
  WHERE id = william_id;
END $$;

COMMIT;
