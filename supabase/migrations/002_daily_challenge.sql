-- ============================================================
-- Daily challenge: auto-populate and transition statuses
-- ============================================================
-- Run ensure_daily_challenge() once per day (e.g. via Supabase Cron,
-- pg_cron, or manually from SQL Editor) to:
--   1. Close ACTIVE challenges whose submission window has ended
--   2. Activate SCHEDULED challenges that have started
--   3. Create today's challenge if none is ACTIVE for today
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_daily_challenge(tz text DEFAULT 'America/Los_Angeles')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_start timestamptz;
  today_end   timestamptz;
  day_index   int;
  comp_type   text;
  comp_types  text[] := ARRAY[
    'center', 'rule_of_thirds', 'golden_ratio', 'triangle',
    'horizontal', 'vertical', 'diagonal', 'symmetric',
    'curved', 'radial', 'vanishing_point', 'pattern', 'fill_the_frame'
  ];
  comp_titles text[] := ARRAY[
    'Center', 'Rule of Thirds', 'Golden Ratio', 'Triangle',
    'Horizontal', 'Vertical', 'Diagonal', 'Symmetric',
    'Curved', 'Radial', 'Vanishing Point', 'Pattern', 'Fill the Frame'
  ];
  new_id      uuid;
  active_id   uuid;
BEGIN
  -- Start/end of "today" in the given timezone (as timestamptz)
  today_start := date_trunc('day', (now() AT TIME ZONE tz)::timestamp) AT TIME ZONE tz;
  today_end   := today_start + interval '1 day' - interval '1 second';

  -- 1) Close ACTIVE challenges whose submissions_close_at has passed
  UPDATE public.challenges
  SET status = 'CLOSED'
  WHERE status = 'ACTIVE'
    AND submissions_close_at < now();

  -- 2) Activate SCHEDULED challenges that have started and not yet closed
  UPDATE public.challenges
  SET status = 'ACTIVE'
  WHERE status = 'SCHEDULED'
    AND starts_at <= now()
    AND submissions_close_at >= now();

  -- 3) Check if there is already an ACTIVE challenge for today (overlaps today's window)
  SELECT id INTO active_id
  FROM public.challenges
  WHERE status = 'ACTIVE'
    AND starts_at <= today_end
    AND submissions_close_at >= today_start
  LIMIT 1;

  IF active_id IS NOT NULL THEN
    RETURN active_id;
  END IF;

  -- 4) Create today's daily challenge (rotate composition by day of year)
  day_index := 1 + (EXTRACT(doy FROM (now() AT TIME ZONE tz)::date)::int % 13);
  comp_type := comp_types[day_index];

  INSERT INTO public.challenges (
    title,
    composition_type,
    description,
    starts_at,
    submissions_close_at,
    status
  ) VALUES (
    'Daily: ' || comp_titles[day_index],
    comp_type,
    'Today''s composition challenge. Shoot a photo that emphasizes ' || lower(comp_titles[day_index]) || '.',
    today_start,
    today_end,
    'ACTIVE'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_daily_challenge(text) IS
  'Ensures one active daily challenge exists: closes expired, activates started, creates today if missing. Call once per day (e.g. cron).';

-- Optional: grant execute to authenticated and anon so Edge Function or cron can call it
GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(text) TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(text) TO service_role;
