-- Weekly capsule streak (Duolingo-style rolling 7-day window)

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS weekly_streak_weeks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_capsule_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_streak_started_at timestamptz;

COMMENT ON COLUMN public.user_stats.weekly_streak_weeks IS
  'Consecutive weeks with at least one capsule completed within each rolling 7-day window.';
COMMENT ON COLUMN public.user_stats.last_capsule_activity_at IS
  'Timestamp of the last capsule completion that counts toward the weekly streak.';
COMMENT ON COLUMN public.user_stats.weekly_streak_started_at IS
  'Anchor timestamp when the current weekly streak chain began.';

-- Backfill last capsule activity from existing progress (best-effort)
UPDATE public.user_stats us
SET last_capsule_activity_at = sub.last_done
FROM (
  SELECT cp.user_id, MAX(COALESCE(cp.data_conclusao, cp.updated_at, cp.created_at)) AS last_done
  FROM public.capsula_progress cp
  WHERE cp.status = 'concluido'
  GROUP BY cp.user_id
) sub
WHERE us.user_id = sub.user_id
  AND us.last_capsule_activity_at IS NULL;

UPDATE public.user_stats
SET weekly_streak_weeks = 1,
    weekly_streak_started_at = last_capsule_activity_at
WHERE last_capsule_activity_at IS NOT NULL
  AND weekly_streak_weeks = 0;
