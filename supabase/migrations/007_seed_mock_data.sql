-- ============================================================
-- Seed mock users, profiles, submissions, reactions, follows
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ============================================================

-- Step 1: Ensure seed challenges exist (re-run 004 inline)
DELETE FROM public.challenges WHERE title LIKE 'Seed:%';

INSERT INTO public.challenges (
  id, title, composition_type, description, cover_image_url, example_image_url,
  starts_at, submissions_close_at, status, participant_count, submission_count
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Seed: Rule of Thirds',
    'rule_of_thirds',
    'Place your subject along the grid lines or at intersections for a balanced, professional look.',
    'https://picsum.photos/800/400?random=1',
    'https://picsum.photos/400/400?random=2',
    now() - interval '1 day',
    now() + interval '1 day',
    'ACTIVE', 0, 0
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Seed: Center Composition',
    'center',
    'Focus the viewer by placing your main subject in the center of the frame.',
    'https://picsum.photos/800/400?random=3',
    NULL,
    now() + interval '2 days',
    now() + interval '3 days',
    'SCHEDULED', 0, 0
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Seed: Leading Lines',
    'vanishing_point',
    'Use lines in the scene to lead the eye toward your subject or a vanishing point.',
    'https://picsum.photos/800/400?random=4',
    NULL,
    now() + interval '4 days',
    now() + interval '5 days',
    'SCHEDULED', 0, 0
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Seed: Fill the Frame',
    'fill_the_frame',
    'Get close and let your subject dominate the frame for maximum impact.',
    'https://picsum.photos/800/400?random=5',
    NULL,
    now() - interval '5 days',
    now() - interval '4 days',
    'CLOSED', 0, 0
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Seed: Symmetry',
    'symmetric',
    'Find or create symmetry for a calm, balanced composition.',
    'https://picsum.photos/800/400?random=6',
    NULL,
    now() - interval '8 days',
    now() - interval '7 days',
    'CLOSED', 0, 0
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  submissions_close_at = EXCLUDED.submissions_close_at;

-- Step 2: Create mock auth users (skips if they already exist)
SET search_path TO public, extensions, auth;
DO $$
DECLARE
  _users jsonb := '[
    {"id": "b0000000-0000-0000-0000-000000000001", "email": "alice@frame.test",   "username": "alice_frames",   "display_name": "Alice Chen"},
    {"id": "b0000000-0000-0000-0000-000000000002", "email": "bob@frame.test",     "username": "bob_shoots",     "display_name": "Bob Martinez"},
    {"id": "b0000000-0000-0000-0000-000000000003", "email": "chris@frame.test",   "username": "chris_clicks",   "display_name": "Chris Park"},
    {"id": "b0000000-0000-0000-0000-000000000004", "email": "dana@frame.test",    "username": "dana_captures",  "display_name": "Dana Rivera"},
    {"id": "b0000000-0000-0000-0000-000000000005", "email": "emma@frame.test",    "username": "emma_lens",      "display_name": "Emma Liu"},
    {"id": "b0000000-0000-0000-0000-000000000006", "email": "frank@frame.test",   "username": "frank_focus",    "display_name": "Frank Kim"}
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

      -- Also add identity so login works
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

-- Step 3: Update profiles with bios, badges, and stats
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

-- Step 4: Seed submissions (for ACTIVE and CLOSED challenges)
DELETE FROM public.submissions WHERE user_id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006'
);

INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- Active challenge: Rule of Thirds
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1015/1000/1000', 'mock/alice/1.jpg',
   'Morning light through the trees', 'rule_of_thirds', 0.92, 1, now() - interval '18 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/1018/1000/1000', 'mock/bob/1.jpg',
   'Mountain reflections', 'rule_of_thirds', 0.85, 2, now() - interval '16 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/1025/1000/1000', 'mock/chris/1.jpg',
   'Quiet street at dawn', 'rule_of_thirds', 0.78, 3, now() - interval '14 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1035/1000/1000', 'mock/dana/1.jpg',
   'City patterns from above', 'rule_of_thirds', 0.88, NULL, now() - interval '10 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1040/1000/1000', 'mock/frank/1.jpg',
   'Golden ratio in nature', 'rule_of_thirds', 0.80, NULL, now() - interval '6 hours'),

  -- Closed challenge: Fill the Frame
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1074/1000/1000', 'mock/alice/2.jpg',
   'Texture close-up', 'fill_the_frame', 0.90, 1, now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1080/1000/1000', 'mock/dana/2.jpg',
   'Flower macro', 'fill_the_frame', 0.87, 2, now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/119/1000/1000', 'mock/frank/2.jpg',
   'Eyes tell stories', 'fill_the_frame', 0.82, 3, now() - interval '5 days'),

  -- Closed challenge: Symmetry
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/164/1000/1000', 'mock/chris/2.jpg',
   'Perfect reflection', 'symmetric', 0.91, 1, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/188/1000/1000', 'mock/bob/2.jpg',
   'Bridge symmetry', 'symmetric', 0.76, 2, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/260/1000/1000', 'mock/emma/1.jpg',
   'Building facade', 'symmetric', 0.70, 3, now() - interval '7 days');

-- Update submission counts on challenges
UPDATE public.challenges SET submission_count = (
  SELECT count(*) FROM public.submissions WHERE challenge_id = challenges.id
);

-- Step 5: Seed some follows between users
INSERT INTO public.follows (follower_id, following_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Update follower/following counts
UPDATE public.user_profiles SET
  follower_count = (SELECT count(*) FROM public.follows WHERE following_id = user_profiles.id),
  following_count = (SELECT count(*) FROM public.follows WHERE follower_id = user_profiles.id);

-- Step 6: Seed some reactions
INSERT INTO public.reactions (submission_id, user_id)
SELECT s.id, f.follower_id
FROM public.submissions s
JOIN public.follows f ON f.following_id = s.user_id
WHERE s.score > 0.8
ON CONFLICT DO NOTHING;
