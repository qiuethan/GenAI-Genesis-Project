-- ============================================================
-- UNIFIED SEED SCRIPT
-- Seeds the entire database with mock data.
-- Run in Supabase SQL Editor. Safe to run multiple times.
--
-- PREREQUISITE: Upload the 12 photos to the 'submissions' bucket
-- under the path: submissions/{filename}
-- e.g. submissions/submissions/DSCF3714.jpg
-- ============================================================

BEGIN;

-- Ensure pgcrypto functions are accessible
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. CLEAN UP: Remove all previous seed data
-- ============================================================
DELETE FROM public.reactions;
DELETE FROM public.comments;
DELETE FROM public.saved_posts;
DELETE FROM public.submissions;
DELETE FROM public.follows;
DELETE FROM public.challenges WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000013'
);

-- Remove seed auth users (cascade deletes their profiles)
DELETE FROM auth.users WHERE id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000007',
  'b0000000-0000-0000-0000-000000000008'
);

-- ============================================================
-- 2. CREATE MOCK AUTH USERS
-- ============================================================
SET search_path TO public, extensions, auth;
DO $$
DECLARE
  _users jsonb := '[
    {"id": "b0000000-0000-0000-0000-000000000001", "email": "alice@frame.test",   "username": "alice_frames",   "display_name": "Alice Chen"},
    {"id": "b0000000-0000-0000-0000-000000000002", "email": "bob@frame.test",     "username": "bob_shoots",     "display_name": "Bob Martinez"},
    {"id": "b0000000-0000-0000-0000-000000000003", "email": "chris@frame.test",   "username": "chris_clicks",   "display_name": "Chris Park"},
    {"id": "b0000000-0000-0000-0000-000000000004", "email": "dana@frame.test",    "username": "dana_captures",  "display_name": "Dana Rivera"},
    {"id": "b0000000-0000-0000-0000-000000000005", "email": "emma@frame.test",    "username": "emma_lens",      "display_name": "Emma Liu"},
    {"id": "b0000000-0000-0000-0000-000000000006", "email": "frank@frame.test",   "username": "frank_focus",    "display_name": "Frank Kim"},
    {"id": "b0000000-0000-0000-0000-000000000007", "email": "isaac@frame.test",   "username": "isaac_picov",   "display_name": "Isaac Picov"},
    {"id": "b0000000-0000-0000-0000-000000000008", "email": "jessica@frame.test", "username": "jessica_chen",   "display_name": "Jessica Chen"}
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
  bio = 'Street photographer chasing golden hour in every city.',
  avatar_url = 'https://i.pravatar.cc/200?img=47',
  composition_badge = 'Rule of Thirds',
  challenges_entered = 8, podium_finishes = 3, best_rank = 1, avg_score = 0.82
WHERE id = 'b0000000-0000-0000-0000-000000000001';

UPDATE public.user_profiles SET
  display_name = 'Bob Martinez',
  bio = 'Landscape & wildlife. Early mornings, long lenses.',
  avatar_url = 'https://i.pravatar.cc/200?img=12',
  composition_badge = 'Center',
  challenges_entered = 7, podium_finishes = 2, best_rank = 1, avg_score = 0.76
WHERE id = 'b0000000-0000-0000-0000-000000000002';

UPDATE public.user_profiles SET
  display_name = 'Chris Park',
  bio = 'Minimalist photography. Seoul based.',
  avatar_url = 'https://i.pravatar.cc/200?img=51',
  composition_badge = 'Symmetric',
  challenges_entered = 6, podium_finishes = 2, best_rank = 1, avg_score = 0.74
WHERE id = 'b0000000-0000-0000-0000-000000000003';

UPDATE public.user_profiles SET
  display_name = 'Dana Rivera',
  bio = 'Nature macro & patterns. I see textures everywhere.',
  avatar_url = 'https://i.pravatar.cc/200?img=23',
  composition_badge = 'Pattern',
  challenges_entered = 9, podium_finishes = 4, best_rank = 1, avg_score = 0.84
WHERE id = 'b0000000-0000-0000-0000-000000000004';

UPDATE public.user_profiles SET
  display_name = 'Emma Liu',
  bio = 'Architecture & urban geometry. NYC.',
  avatar_url = 'https://i.pravatar.cc/200?img=44',
  challenges_entered = 5, podium_finishes = 1, avg_score = 0.68
WHERE id = 'b0000000-0000-0000-0000-000000000005';

UPDATE public.user_profiles SET
  display_name = 'Frank Kim',
  bio = 'Film photography. Fuji & Leica. Mostly travel.',
  avatar_url = 'https://i.pravatar.cc/200?img=53',
  composition_badge = 'Golden Ratio',
  challenges_entered = 7, podium_finishes = 3, best_rank = 1, avg_score = 0.80
WHERE id = 'b0000000-0000-0000-0000-000000000006';

UPDATE public.user_profiles SET
  display_name = 'Isaac Picov',
  bio = 'Cars, temples, and everything between. Fujifilm shooter.',
  avatar_url = 'https://i.pravatar.cc/200?img=68',
  composition_badge = 'Vanishing Point',
  challenges_entered = 12, podium_finishes = 6, best_rank = 1, avg_score = 0.89
WHERE id = 'b0000000-0000-0000-0000-000000000007';

UPDATE public.user_profiles SET
  display_name = 'Jessica Chen',
  bio = 'Travel & landscapes. Switzerland, Canada, and wherever the light takes me. Nikon shooter.',
  avatar_url = 'https://i.pravatar.cc/200?img=5',
  composition_badge = 'Symmetric',
  challenges_entered = 9, podium_finishes = 4, best_rank = 1, avg_score = 0.86
WHERE id = 'b0000000-0000-0000-0000-000000000008';

-- ============================================================
-- 4. SEED CHALLENGES — thematic topics with composition types
-- ============================================================
INSERT INTO public.challenges (
  id, title, composition_type, description,
  cover_image_url, starts_at, submissions_close_at, status
) VALUES
  -- ===== ACTIVE challenges =====
  ('a0000000-0000-0000-0000-000000000001',
   'Urban Rush',
   'diagonal',
   'Capture the energy of city life using strong diagonal lines — staircases, escalators, leaning buildings, or the flow of traffic.',
   'https://picsum.photos/id/1026/800/400',
   now() - interval '1 day', now() + interval '1 day', 'ACTIVE'),

  ('a0000000-0000-0000-0000-000000000002',
   'Wildlife Portraits',
   'center',
   'Get eye-to-eye with an animal. Place your subject dead center for maximum presence and connection.',
   'https://picsum.photos/id/593/800/400',
   now() - interval '12 hours', now() + interval '2 days', 'ACTIVE'),

  ('a0000000-0000-0000-0000-000000000003',
   'Horizon Lines',
   'horizontal',
   'Oceans, prairies, skylines — find the longest horizontal line in your world and let it anchor the frame.',
   'https://picsum.photos/id/1043/800/400',
   now() - interval '6 hours', now() + interval '3 days', 'ACTIVE'),

  -- ===== SCHEDULED (upcoming) =====
  ('a0000000-0000-0000-0000-000000000013',
   'Night Architecture',
   'vertical',
   'Skyscrapers, columns, lampposts — shoot vertical lines after dark when the lights come on.',
   'https://picsum.photos/id/374/800/400',
   now() + interval '2 days', now() + interval '4 days', 'SCHEDULED'),

  -- ===== CLOSED challenges =====
  ('a0000000-0000-0000-0000-000000000004',
   'Winding Roads',
   'curved',
   'S-curves, spiral staircases, winding rivers — follow the curve and let it lead the eye through your image.',
   'https://picsum.photos/id/1044/800/400',
   now() - interval '10 days', now() - interval '9 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000005',
   'Paths & Tunnels',
   'vanishing_point',
   'Roads, corridors, train tracks — find a scene where parallel lines converge toward a single distant point.',
   'https://picsum.photos/id/167/800/400',
   now() - interval '8 days', now() - interval '7 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000006',
   'Golden Hour Landscapes',
   'rule_of_thirds',
   'Chase the warm light. Place the horizon on a third line and let the sky or foreground dominate.',
   'https://picsum.photos/id/1039/800/400',
   now() - interval '6 days', now() - interval '5 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000007',
   'Nature Textures',
   'pattern',
   'Bark, leaves, feathers, scales — zoom in on nature''s repeating patterns and fill the frame with rhythm.',
   'https://picsum.photos/id/309/800/400',
   now() - interval '14 days', now() - interval '13 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000008',
   'Reflections',
   'symmetric',
   'Puddles, lakes, glass facades — find a mirror in the world and split your frame in two.',
   'https://picsum.photos/id/164/800/400',
   now() - interval '12 days', now() - interval '11 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000009',
   'Macro World',
   'fill_the_frame',
   'Get as close as you can. Insects, flowers, water drops — let tiny details become monumental.',
   'https://picsum.photos/id/152/800/400',
   now() - interval '16 days', now() - interval '15 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000010',
   'Calm Waters',
   'golden_ratio',
   'Lakes, ponds, slow rivers — compose with the golden spiral to create effortless balance.',
   'https://picsum.photos/id/1036/800/400',
   now() - interval '18 days', now() - interval '17 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000011',
   'Mountain Peaks',
   'triangle',
   'Summits, rooftops, tents — arrange triangular shapes for a sense of strength and stability.',
   'https://picsum.photos/id/29/800/400',
   now() - interval '20 days', now() - interval '19 days', 'CLOSED'),

  ('a0000000-0000-0000-0000-000000000012',
   'Sunbursts',
   'radial',
   'Peer through trees, fences, or windows to catch light radiating outward from a single bright point.',
   'https://picsum.photos/id/137/800/400',
   now() - interval '22 days', now() - interval '21 days', 'CLOSED')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_image_url = EXCLUDED.cover_image_url,
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  submissions_close_at = EXCLUDED.submissions_close_at;

-- ============================================================
-- 5. SEED ISAAC'S SUBMISSIONS (12 photos from storage bucket)
-- ============================================================
INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- Urban Rush (diagonal) — yellow Lamborghini cutting diagonally
  ('a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF3714.jpg',
   'DSCF3714.jpg',
   'Neon yellow cutting through the crowd',
   'diagonal', 0.93, 1, now() - interval '20 hours'),

  -- Wildlife Portraits (center) — Bugatti head-on, dead center
  ('a0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF3749.jpg',
   'DSCF3749.jpg',
   'The horseshoe grille demands center stage',
   'center', 0.91, NULL, now() - interval '10 hours'),

  -- Horizon Lines (horizontal) — Ferrari motion blur
  ('a0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF3781.jpg',
   'DSCF3781.jpg',
   'Time bends around a classic F355',
   'horizontal', 0.90, NULL, now() - interval '4 hours'),

  -- Winding Roads (curved) — spiral staircase
  ('a0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF5783.jpg',
   'DSCF5783.jpg',
   'Concrete curves against endless blue',
   'curved', 0.94, 1, now() - interval '10 days'),

  -- Paths & Tunnels (vanishing_point) — torii gate stairs
  ('a0000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6373.jpg',
   'DSCF6373.jpg',
   'A thousand gates, one destination',
   'vanishing_point', 0.95, 1, now() - interval '8 days'),

  -- Golden Hour Landscapes (rule_of_thirds) — torii gates from above
  ('a0000000-0000-0000-0000-000000000006',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6378.jpg',
   'DSCF6378.jpg',
   'Vermillion threads through the canopy',
   'rule_of_thirds', 0.88, 2, now() - interval '6 days'),

  -- Nature Textures (pattern) — fox ema plaques
  ('a0000000-0000-0000-0000-000000000007',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6386.jpg',
   'DSCF6386.jpg',
   'Foxes watching over an uninvited guest',
   'pattern', 0.92, 1, now() - interval '14 days'),

  -- Sunbursts (radial) — orange hazy torii gate
  ('a0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6420.jpg',
   'DSCF6420.jpg',
   'When the light finds the gate',
   'radial', 0.86, 2, now() - interval '22 days'),

  -- Reflections (symmetric) — red torii tunnel at night
  ('a0000000-0000-0000-0000-000000000008',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6446.jpg',
   'DSCF6446.jpg',
   'Symmetry written in kanji and vermillion',
   'symmetric', 0.93, 1, now() - interval '12 days'),

  -- Macro World (fill_the_frame) — deer portrait
  ('a0000000-0000-0000-0000-000000000009',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6469.jpg',
   'DSCF6469.jpg',
   'The king of Nara Park',
   'fill_the_frame', 0.91, 1, now() - interval '16 days'),

  -- Calm Waters (golden_ratio) — young deer on grass
  ('a0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6481.jpg',
   'DSCF6481.jpg',
   'Spotted fawn at the golden spiral',
   'golden_ratio', 0.87, 1, now() - interval '18 days'),

  -- Mountain Peaks (triangle) — Tokyo Tower cityscape
  ('a0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000007',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/submissions/DSCF6843.jpg',
   'DSCF6843.jpg',
   'Tokyo Tower rising through a ghost layer',
   'triangle', 0.89, 1, now() - interval '20 days');

-- ============================================================
-- 5b. SEED JESSICA'S SUBMISSIONS (9 photos from storage bucket)
-- ============================================================
INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- Reflections (symmetric) — Lucerne church mirrored in water
  ('a0000000-0000-0000-0000-000000000008',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczMAExcgtxEUbxPdT2JrG9MoX6fbTGQ5OpojKwALNARKg22nRmfx1xiVw2250-h1688-s-no.png',
   'Jessica/AP1GczMAExcgtxEUbxPdT2JrG9MoX6fbTGQ5OpojKwALNARKg22nRmfx1xiVw2250-h1688-s-no.png',
   'Lucerne at rest — the river holds the church twice',
   'symmetric', 0.92, NULL, now() - interval '11 days'),

  -- Sunbursts (radial) — Aurora borealis through branches
  ('a0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczMnzrJ-4UMOFYeegxUJuHhIyb34-B_W2-nDqKnbtjETRu7Mi1BR8aTTw1266-h1688-s-no.png',
   'Jessica/AP1GczMnzrJ-4UMOFYeegxUJuHhIyb34-B_W2-nDqKnbtjETRu7Mi1BR8aTTw1266-h1688-s-no.png',
   'Northern lights painting through the apple blossoms',
   'radial', 0.94, NULL, now() - interval '21 days'),

  -- Paths & Tunnels (vanishing_point) — Swiss highway into mountains
  ('a0000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczOrB9Qettd3kuHb8t6T6Q-iRlJnNtfEmruYMyKpAzPZwvcG1V-T_dojw2250-h1688-s-no.png',
   'Jessica/AP1GczOrB9Qettd3kuHb8t6T6Q-iRlJnNtfEmruYMyKpAzPZwvcG1V-T_dojw2250-h1688-s-no.png',
   'The autobahn dissolves into the Alps',
   'vanishing_point', 0.91, NULL, now() - interval '7 days'),

  -- Macro World (fill_the_frame) — Bokeh lantern close-up
  ('a0000000-0000-0000-0000-000000000009',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczNjCUmj3aj70XapDRaX8zqf4x6tTWjbv6x8gESGWKTcEFnM4zL61k03w1266-h1688-s-no.png',
   'Jessica/AP1GczNjCUmj3aj70XapDRaX8zqf4x6tTWjbv6x8gESGWKTcEFnM4zL61k03w1266-h1688-s-no.png',
   'One bulb, a thousand bokeh companions',
   'fill_the_frame', 0.88, NULL, now() - interval '15 days'),

  -- Calm Waters (golden_ratio) — Swiss alpine village panorama
  ('a0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczOY1TbWav8-GIFOaYziTy7sFOJSw5pzUd6GI9HpG1_o5AZkDSPUQ1ryw2992-h1684-s-no.png',
   'Jessica/AP1GczOY1TbWav8-GIFOaYziTy7sFOJSw5pzUd6GI9HpG1_o5AZkDSPUQ1ryw2992-h1684-s-no.png',
   'The valley keeps its secrets in green and white',
   'golden_ratio', 0.90, NULL, now() - interval '17 days'),

  -- Winding Roads (curved) — Frozen waterfall canyon
  ('a0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczOYh8GY9fj6UWsTjcGgZSOI3dVpl-A_pFaufW9w03AzdxmNg-srvhs4w1266-h1688-s-no.png',
   'Jessica/AP1GczOYh8GY9fj6UWsTjcGgZSOI3dVpl-A_pFaufW9w03AzdxmNg-srvhs4w1266-h1688-s-no.png',
   'Ice carved its own winding path through the canyon',
   'curved', 0.93, NULL, now() - interval '9 days'),

  -- Golden Hour Landscapes (rule_of_thirds) — Chinese dancer on stage
  ('a0000000-0000-0000-0000-000000000006',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczPG8WxyBg0yFNPPHzv_NqiW6Q_OS9K_bQrqb3sNxeoagTo6whLwfjxFw2532-h1688-s-no.png',
   'Jessica/AP1GczPG8WxyBg0yFNPPHzv_NqiW6Q_OS9K_bQrqb3sNxeoagTo6whLwfjxFw2532-h1688-s-no.png',
   'Silk catching the spotlight — one breath, one frame',
   'rule_of_thirds', 0.89, NULL, now() - interval '5 days'),

  -- Wildlife Portraits (center) — Self-portrait through glass
  ('a0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczPKpNgX3YSagIj8JHYihzfwjlPUxTCS23q5GVw6kypE1ZYC6mSYqsSizww2532-h1688-s-no.png',
   'Jessica/AP1GczPKpNgX3YSagIj8JHYihzfwjlPUxTCS23q5GVw6kypE1ZYC6mSYqsSizww2532-h1688-s-no.png',
   'Ghost in the glass — hat, camera, city',
   'center', 0.82, NULL, now() - interval '8 hours'),

  -- Urban Rush (diagonal) — Bern cobblestone street with flags
  ('a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000008',
   'https://xwtrkqzkwgxbluprpjur.supabase.co/storage/v1/object/public/submissions/Jessica/AP1GczPm9UeD04E2n_CVJQpAUOLFmmx1jOqn6-DlVreBTTPp3S77qDu7wfwwcQw2532-h1688-s-no.png',
   'Jessica/AP1GczPm9UeD04E2n_CVJQpAUOLFmmx1jOqn6-DlVreBTTPp3S77qDu7wfwwcQw2532-h1688-s-no.png',
   'Cobblestones and Swiss flags — Bern from ground level',
   'diagonal', 0.86, NULL, now() - interval '15 hours');

-- ============================================================
-- 6. SEED OTHER USERS' SUBMISSIONS (thematic, varied scores)
--    Using picsum IDs that roughly match each challenge theme
-- ============================================================
INSERT INTO public.submissions (
  challenge_id, user_id, photo_url, photo_storage_path, caption,
  composition_type, score, rank, submitted_at
) VALUES
  -- ===== Urban Rush (diagonal) — city energy =====
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1026/1000/1000', 'mock/alice/urban1.jpg',
   'Crosswalk chaos at rush hour', 'diagonal', 0.87, 2, now() - interval '18 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1029/1000/1000', 'mock/dana/urban1.jpg',
   'Fire escape zigzag', 'diagonal', 0.81, 3, now() - interval '16 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/1031/1000/1000', 'mock/chris/urban1.jpg',
   'Subway stairs at midnight', 'diagonal', 0.74, 4, now() - interval '14 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1058/1000/1000', 'mock/frank/urban1.jpg',
   'Leaning tower of scaffolding', 'diagonal', 0.69, 5, now() - interval '12 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/1033/1000/1000', 'mock/emma/urban1.jpg',
   'Angled glass and steel', 'diagonal', 0.62, 6, now() - interval '10 hours'),

  -- ===== Wildlife Portraits (center) — animals =====
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/237/1000/1000', 'mock/bob/wildlife1.jpg',
   'Eye to eye with a black lab', 'center', 0.88, NULL, now() - interval '9 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1074/1000/1000', 'mock/dana/wildlife1.jpg',
   'Monarch butterfly resting', 'center', 0.83, NULL, now() - interval '8 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1024/1000/1000', 'mock/alice/wildlife1.jpg',
   'Curious cat in the window', 'center', 0.76, NULL, now() - interval '7 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/582/1000/1000', 'mock/frank/wildlife1.jpg',
   'Heron standing perfectly still', 'center', 0.71, NULL, now() - interval '6 hours'),

  -- ===== Horizon Lines (horizontal) — landscapes =====
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/1043/1000/1000', 'mock/bob/horizon1.jpg',
   'Where the prairie meets the sky', 'horizontal', 0.85, NULL, now() - interval '5 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1015/1000/1000', 'mock/alice/horizon1.jpg',
   'Ocean horizon at dusk', 'horizontal', 0.79, NULL, now() - interval '4 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/1018/1000/1000', 'mock/emma/horizon1.jpg',
   'Fog rolling over the ridgeline', 'horizontal', 0.72, NULL, now() - interval '3 hours'),

  -- ===== Winding Roads (curved) =====
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1044/1000/1000', 'mock/dana/curved1.jpg',
   'River bend from the cliffside', 'curved', 0.89, 2, now() - interval '10 days'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1047/1000/1000', 'mock/alice/curved1.jpg',
   'Winding coastal highway', 'curved', 0.78, 3, now() - interval '10 days'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1050/1000/1000', 'mock/frank/curved1.jpg',
   'Corkscrew parking garage', 'curved', 0.72, 4, now() - interval '9 days'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/1053/1000/1000', 'mock/emma/curved1.jpg',
   'Art deco spiral railing', 'curved', 0.65, 5, now() - interval '9 days'),

  -- ===== Paths & Tunnels (vanishing_point) =====
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/167/1000/1000', 'mock/dana/tunnel1.jpg',
   'Rail lines vanish into mist', 'vanishing_point', 0.90, 2, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1080/1000/1000', 'mock/frank/tunnel1.jpg',
   'Endless hallway', 'vanishing_point', 0.82, 3, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/214/1000/1000', 'mock/chris/tunnel1.jpg',
   'Metro tunnel echo', 'vanishing_point', 0.73, 4, now() - interval '7 days'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/247/1000/1000', 'mock/bob/tunnel1.jpg',
   'Forest trail fading away', 'vanishing_point', 0.66, 5, now() - interval '7 days'),

  -- ===== Golden Hour Landscapes (rule_of_thirds) =====
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/1039/1000/1000', 'mock/alice/golden1.jpg',
   'Sun kissing the mountain ridge', 'rule_of_thirds', 0.91, 1, now() - interval '6 days'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/1036/1000/1000', 'mock/bob/golden1.jpg',
   'Amber light on the lake', 'rule_of_thirds', 0.84, 3, now() - interval '6 days'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/1055/1000/1000', 'mock/emma/golden1.jpg',
   'Rooftop sunset silhouette', 'rule_of_thirds', 0.77, 4, now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/1059/1000/1000', 'mock/chris/golden1.jpg',
   'Last light on the wheat field', 'rule_of_thirds', 0.68, 5, now() - interval '5 days'),

  -- ===== Nature Textures (pattern) =====
  ('a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/309/1000/1000', 'mock/dana/texture1.jpg',
   'Leaf veins under magnification', 'pattern', 0.90, 2, now() - interval '14 days'),
  ('a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/312/1000/1000', 'mock/bob/texture1.jpg',
   'Pine bark up close', 'pattern', 0.79, 3, now() - interval '13 days'),
  ('a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/315/1000/1000', 'mock/alice/texture1.jpg',
   'Honeycomb on the hive', 'pattern', 0.71, 4, now() - interval '13 days'),
  ('a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/318/1000/1000', 'mock/emma/texture1.jpg',
   'Tile mosaic close-up', 'pattern', 0.63, 5, now() - interval '13 days'),

  -- ===== Reflections (symmetric) =====
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/164/1000/1000', 'mock/chris/reflect1.jpg',
   'Perfect lake reflection', 'symmetric', 0.91, 2, now() - interval '12 days'),
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/188/1000/1000', 'mock/emma/reflect1.jpg',
   'Building mirrored in puddle', 'symmetric', 0.75, 3, now() - interval '11 days'),
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/260/1000/1000', 'mock/bob/reflect1.jpg',
   'Bridge doubled in still water', 'symmetric', 0.67, 4, now() - interval '11 days'),
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/275/1000/1000', 'mock/frank/reflect1.jpg',
   'Storefront glass at twilight', 'symmetric', 0.58, 5, now() - interval '11 days'),

  -- ===== Macro World (fill_the_frame) =====
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/152/1000/1000', 'mock/dana/macro1.jpg',
   'Dew drop on a petal', 'fill_the_frame', 0.89, 2, now() - interval '16 days'),
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/155/1000/1000', 'mock/alice/macro1.jpg',
   'Rust texture abstractions', 'fill_the_frame', 0.82, 3, now() - interval '16 days'),
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/119/1000/1000', 'mock/frank/macro1.jpg',
   'Eye of the cat', 'fill_the_frame', 0.74, 4, now() - interval '15 days'),
  ('a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/106/1000/1000', 'mock/chris/macro1.jpg',
   'Sunflower center spiral', 'fill_the_frame', 0.61, 5, now() - interval '15 days'),

  -- ===== Calm Waters (golden_ratio) =====
  ('a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/1036/1000/1000', 'mock/frank/calm1.jpg',
   'Canoe on a glassy lake', 'golden_ratio', 0.85, 2, now() - interval '18 days'),
  ('a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/1015/1000/1000', 'mock/bob/calm1.jpg',
   'River stones under clear water', 'golden_ratio', 0.76, 3, now() - interval '17 days'),
  ('a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004',
   'https://picsum.photos/id/1019/1000/1000', 'mock/dana/calm1.jpg',
   'Lily pad meditation', 'golden_ratio', 0.70, 4, now() - interval '17 days'),

  -- ===== Mountain Peaks (triangle) =====
  ('a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/29/1000/1000', 'mock/bob/peak1.jpg',
   'Alpine summit at dawn', 'triangle', 0.88, 2, now() - interval '20 days'),
  ('a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/377/1000/1000', 'mock/alice/peak1.jpg',
   'Tent triangle against the stars', 'triangle', 0.79, 3, now() - interval '19 days'),
  ('a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005',
   'https://picsum.photos/id/1018/1000/1000', 'mock/emma/peak1.jpg',
   'Glass pyramid downtown', 'triangle', 0.66, 4, now() - interval '19 days'),

  -- ===== Sunbursts (radial) =====
  ('a0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000006',
   'https://picsum.photos/id/137/1000/1000', 'mock/frank/sun1.jpg',
   'Sun breaking through redwoods', 'radial', 0.90, 1, now() - interval '22 days'),
  ('a0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001',
   'https://picsum.photos/id/142/1000/1000', 'mock/alice/sun1.jpg',
   'Starburst through the fence', 'radial', 0.80, 3, now() - interval '21 days'),
  ('a0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000003',
   'https://picsum.photos/id/146/1000/1000', 'mock/chris/sun1.jpg',
   'Light rays in a dusty warehouse', 'radial', 0.71, 4, now() - interval '21 days'),
  ('a0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002',
   'https://picsum.photos/id/151/1000/1000', 'mock/bob/sun1.jpg',
   'Morning haze through branches', 'radial', 0.59, 5, now() - interval '21 days');

-- ============================================================
-- 7. UPDATE CHALLENGE COUNTS
-- ============================================================
UPDATE public.challenges SET
  submission_count = (SELECT count(*) FROM public.submissions WHERE challenge_id = challenges.id),
  participant_count = (SELECT count(DISTINCT user_id) FROM public.submissions WHERE challenge_id = challenges.id);

-- ============================================================
-- 8. SEED FOLLOWS (a realistic social graph)
-- ============================================================
INSERT INTO public.follows (follower_id, following_id) VALUES
  -- Everyone follows Isaac (he's the most active)
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
  -- Alice <-> Bob (mutual)
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  -- Alice <-> Dana (mutual)
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  -- Chris -> Dana, Emma -> Chris
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003'),
  -- Frank <-> Dana
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006'),
  -- Bob -> Frank, Chris -> Alice
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  -- Jessica follows Isaac, Alice, Dana; Isaac and Alice follow Jessica back
  ('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

-- Update follower/following counts
UPDATE public.user_profiles SET
  follower_count = (SELECT count(*) FROM public.follows WHERE following_id = user_profiles.id),
  following_count = (SELECT count(*) FROM public.follows WHERE follower_id = user_profiles.id);

-- ============================================================
-- 9. SEED REACTIONS (varied — not just high scorers)
-- ============================================================
-- Followers react to people they follow (most submissions)
INSERT INTO public.reactions (submission_id, user_id)
SELECT s.id, f.follower_id
FROM public.submissions s
JOIN public.follows f ON f.following_id = s.user_id
WHERE s.score > 0.75
ON CONFLICT DO NOTHING;

-- Extra reactions from active users on random good submissions
INSERT INTO public.reactions (submission_id, user_id)
SELECT s.id, 'b0000000-0000-0000-0000-000000000001'
FROM public.submissions s WHERE s.score > 0.85 AND s.user_id != 'b0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO public.reactions (submission_id, user_id)
SELECT s.id, 'b0000000-0000-0000-0000-000000000004'
FROM public.submissions s WHERE s.score > 0.80 AND s.user_id != 'b0000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. SEED COMMENTS
-- ============================================================
INSERT INTO public.comments (submission_id, user_id, body)
SELECT s.id, 'b0000000-0000-0000-0000-000000000001', 'Amazing composition!'
FROM public.submissions s WHERE s.score > 0.90 AND s.user_id != 'b0000000-0000-0000-0000-000000000001'
LIMIT 3;

INSERT INTO public.comments (submission_id, user_id, body)
SELECT s.id, 'b0000000-0000-0000-0000-000000000002', 'Love the lighting here'
FROM public.submissions s WHERE s.score > 0.88 AND s.user_id != 'b0000000-0000-0000-0000-000000000002'
LIMIT 2;

INSERT INTO public.comments (submission_id, user_id, body)
SELECT s.id, 'b0000000-0000-0000-0000-000000000004', 'This is so sharp, great eye!'
FROM public.submissions s WHERE s.score > 0.85 AND s.user_id != 'b0000000-0000-0000-0000-000000000004'
LIMIT 4;

-- ============================================================
-- 11. SEED WILLIAM'S PROFILE (mutual follows + podiums)
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
        'b0000000-0000-0000-0000-000000000007',
        'b0000000-0000-0000-0000-000000000008'
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
