-- ============================================================
-- Schedule ensure_daily_challenge() to run once per day
-- ============================================================
-- Requires pg_cron: enable it in Dashboard > Database > Extensions
-- (or Integrations > Cron). If pg_cron is not available, run
--   SELECT public.ensure_daily_challenge();
-- manually from SQL Editor once per day, or from an external cron.
--
-- Runs at 08:00 UTC (= midnight Pacific); adjust schedule if needed.
-- ============================================================

SELECT cron.schedule(
  'frame-daily-challenge',
  '0 8 * * *',
  $$SELECT public.ensure_daily_challenge('America/Los_Angeles')$$
);
