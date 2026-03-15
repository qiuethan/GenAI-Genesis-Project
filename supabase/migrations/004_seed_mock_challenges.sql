-- ============================================================
-- Seed mock challenges for testing
-- ============================================================
-- Run after 001_initial_schema. Safe to run multiple times.
-- ============================================================

DELETE FROM public.challenges WHERE title LIKE 'Seed: %';

INSERT INTO public.challenges (
  id,
  title,
  composition_type,
  description,
  cover_image_url,
  example_image_url,
  starts_at,
  submissions_close_at,
  status,
  participant_count,
  submission_count
) VALUES
  -- ACTIVE: one challenge live now (starts in past, ends in future)
  (
    gen_random_uuid(),
    'Seed: Rule of Thirds',
    'rule_of_thirds',
    'Place your subject along the grid lines or at intersections for a balanced, professional look.',
    'https://picsum.photos/800/400?random=1',
    'https://picsum.photos/400/400?random=2',
    now() - interval '1 day',
    now() + interval '1 day',
    'ACTIVE',
    0,
    0
  ),
  -- SCHEDULED: two upcoming
  (
    gen_random_uuid(),
    'Seed: Center Composition',
    'center',
    'Focus the viewer by placing your main subject in the center of the frame.',
    'https://picsum.photos/800/400?random=3',
    NULL,
    now() + interval '2 days',
    now() + interval '3 days',
    'SCHEDULED',
    0,
    0
  ),
  (
    gen_random_uuid(),
    'Seed: Leading Lines',
    'vanishing_point',
    'Use lines in the scene to lead the eye toward your subject or a vanishing point.',
    'https://picsum.photos/800/400?random=4',
    NULL,
    now() + interval '4 days',
    now() + interval '5 days',
    'SCHEDULED',
    0,
    0
  ),
  -- CLOSED: two past challenges
  (
    gen_random_uuid(),
    'Seed: Fill the Frame',
    'fill_the_frame',
    'Get close and let your subject dominate the frame for maximum impact.',
    'https://picsum.photos/800/400?random=5',
    NULL,
    now() - interval '5 days',
    now() - interval '4 days',
    'CLOSED',
    0,
    0
  ),
  (
    gen_random_uuid(),
    'Seed: Symmetry',
    'symmetric',
    'Find or create symmetry for a calm, balanced composition.',
    'https://picsum.photos/800/400?random=6',
    NULL,
    now() - interval '8 days',
    now() - interval '7 days',
    'CLOSED',
    0,
    0
  )
;
