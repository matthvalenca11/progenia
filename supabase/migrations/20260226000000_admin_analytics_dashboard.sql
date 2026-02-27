-- Analytics base para dashboard admin
CREATE TABLE IF NOT EXISTS public.lab_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.virtual_labs(id) ON DELETE CASCADE,
  capsula_id uuid REFERENCES public.capsulas(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  event_type text NOT NULL,
  duration_seconds integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lab_usage_events_event_type_check'
  ) THEN
    ALTER TABLE public.lab_usage_events
      ADD CONSTRAINT lab_usage_events_event_type_check
      CHECK (event_type IN ('open', 'interaction', 'close', 'complete'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_usage_events_created_at ON public.lab_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_lab_usage_events_user_id ON public.lab_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_usage_events_lab_id ON public.lab_usage_events(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_usage_events_event_type ON public.lab_usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lab_usage_events_session_id ON public.lab_usage_events(session_id);

ALTER TABLE public.lab_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own lab usage events"
  ON public.lab_usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read lab usage events"
  ON public.lab_usage_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- View simples para consultas rápidas
CREATE OR REPLACE VIEW public.admin_dashboard_overview AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.lessons WHERE is_published = true) AS total_lessons_published,
  (SELECT COUNT(*) FROM public.capsulas WHERE is_published = true) AS total_capsulas_published,
  (SELECT COUNT(*) FROM public.virtual_labs WHERE is_published = true) AS total_labs_published,
  (SELECT COUNT(*) FROM public.lesson_progress WHERE status = 'concluido') AS lesson_completions,
  (SELECT COUNT(*) FROM public.capsula_progress WHERE status = 'concluido') AS capsula_completions,
  (SELECT COUNT(*) FROM public.lab_usage_events WHERE event_type = 'open') AS lab_sessions;

CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis(
  p_start timestamptz,
  p_end timestamptz,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  total_users bigint,
  new_users bigint,
  active_users bigint,
  lesson_completions bigint,
  capsula_completions bigint,
  avg_lesson_progress numeric,
  total_lab_sessions bigint,
  total_lab_time_seconds bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
  )
  SELECT
    (SELECT COUNT(*) FROM public.profiles p WHERE p.id IN (SELECT id FROM filtered_users)),
    (SELECT COUNT(*) FROM public.profiles p
      WHERE p.id IN (SELECT id FROM filtered_users)
        AND p.created_at >= p_start
        AND p.created_at <= p_end),
    (SELECT COUNT(*) FROM public.user_stats us
      WHERE us.user_id IN (SELECT id FROM filtered_users)
        AND us.last_activity_date >= p_start::date
        AND us.last_activity_date <= p_end::date),
    (SELECT COUNT(*) FROM public.lesson_progress lp
      WHERE lp.user_id IN (SELECT id FROM filtered_users)
        AND lp.status = 'concluido'
        AND lp.data_conclusao >= p_start
        AND lp.data_conclusao <= p_end),
    (SELECT COUNT(*) FROM public.capsula_progress cp
      WHERE cp.user_id IN (SELECT id FROM filtered_users)
        AND cp.status = 'concluido'
        AND cp.data_conclusao >= p_start
        AND cp.data_conclusao <= p_end),
    COALESCE((
      SELECT AVG(lp.progress_percentage)::numeric
      FROM public.lesson_progress lp
      WHERE lp.user_id IN (SELECT id FROM filtered_users)
        AND lp.updated_at >= p_start
        AND lp.updated_at <= p_end
    ), 0),
    (SELECT COUNT(*) FROM public.lab_usage_events lue
      WHERE lue.user_id IN (SELECT id FROM filtered_users)
        AND lue.event_type = 'open'
        AND lue.created_at >= p_start
        AND lue.created_at <= p_end),
    COALESCE((
      SELECT SUM(COALESCE(lue.duration_seconds, 0))
      FROM public.lab_usage_events lue
      WHERE lue.user_id IN (SELECT id FROM filtered_users)
        AND lue.event_type = 'close'
        AND lue.created_at >= p_start
        AND lue.created_at <= p_end
    ), 0);
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_signups_series(
  p_start timestamptz,
  p_end timestamptz,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  period date,
  signups bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(p_start::date, p_end::date, interval '1 day')::date AS period
  ),
  signups_grouped AS (
    SELECT date_trunc('day', p.created_at)::date AS period, COUNT(*)::bigint AS count_signups
    FROM public.profiles p
    WHERE p.created_at >= p_start
      AND p.created_at <= p_end
      AND (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
    GROUP BY 1
  )
  SELECT d.period, COALESCE(sg.count_signups, 0)::bigint
  FROM days d
  LEFT JOIN signups_grouped sg ON sg.period = d.period
  ORDER BY d.period;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_demographics(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (
  dimension text,
  label text,
  total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'gender'::text AS dimension, COALESCE(p.gender, 'Não informado') AS label, COUNT(*)::bigint AS total
  FROM public.profiles p
  WHERE p.created_at >= p_start AND p.created_at <= p_end
  GROUP BY p.gender

  UNION ALL

  SELECT 'state_uf'::text AS dimension, COALESCE(p.state_uf, 'Não informado') AS label, COUNT(*)::bigint AS total
  FROM public.profiles p
  WHERE p.created_at >= p_start AND p.created_at <= p_end
  GROUP BY p.state_uf

  UNION ALL

  SELECT 'education_level'::text AS dimension, COALESCE(p.education_level, 'Não informado') AS label, COUNT(*)::bigint AS total
  FROM public.profiles p
  WHERE p.created_at >= p_start AND p.created_at <= p_end
  GROUP BY p.education_level

  UNION ALL

  SELECT 'profession'::text AS dimension, COALESCE(p.profession, 'Não informado') AS label, COUNT(*)::bigint AS total
  FROM public.profiles p
  WHERE p.created_at >= p_start AND p.created_at <= p_end
  GROUP BY p.profession;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_content_usage(
  p_start timestamptz,
  p_end timestamptz,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  content_type text,
  status text,
  total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
  )
  SELECT 'lesson'::text AS content_type, COALESCE(lp.status::text, 'Não informado') AS status, COUNT(*)::bigint AS total
  FROM public.lesson_progress lp
  WHERE lp.user_id IN (SELECT id FROM filtered_users)
    AND lp.updated_at >= p_start
    AND lp.updated_at <= p_end
  GROUP BY lp.status

  UNION ALL

  SELECT 'capsula'::text AS content_type, COALESCE(cp.status::text, 'Não informado') AS status, COUNT(*)::bigint AS total
  FROM public.capsula_progress cp
  WHERE cp.user_id IN (SELECT id FROM filtered_users)
    AND cp.updated_at >= p_start
    AND cp.updated_at <= p_end
  GROUP BY cp.status;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_top_content(
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer DEFAULT 10,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  content_type text,
  content_id uuid,
  title text,
  starts bigint,
  completions bigint,
  completion_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
  ),
  lesson_rank AS (
    SELECT
      'lesson'::text AS content_type,
      l.id AS content_id,
      l.title AS title,
      COUNT(lp.id)::bigint AS starts,
      COUNT(lp.id) FILTER (WHERE lp.status = 'concluido')::bigint AS completions,
      COALESCE(
        ROUND(
          (COUNT(lp.id) FILTER (WHERE lp.status = 'concluido')::numeric / NULLIF(COUNT(lp.id), 0)::numeric) * 100,
          2
        ),
        0
      ) AS completion_rate
    FROM public.lessons l
    LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id
      AND lp.user_id IN (SELECT id FROM filtered_users)
      AND lp.updated_at >= p_start
      AND lp.updated_at <= p_end
    GROUP BY l.id, l.title
  ),
  capsula_rank AS (
    SELECT
      'capsula'::text AS content_type,
      c.id AS content_id,
      c.title AS title,
      COUNT(cp.id)::bigint AS starts,
      COUNT(cp.id) FILTER (WHERE cp.status = 'concluido')::bigint AS completions,
      COALESCE(
        ROUND(
          (COUNT(cp.id) FILTER (WHERE cp.status = 'concluido')::numeric / NULLIF(COUNT(cp.id), 0)::numeric) * 100,
          2
        ),
        0
      ) AS completion_rate
    FROM public.capsulas c
    LEFT JOIN public.capsula_progress cp ON cp.capsula_id = c.id
      AND cp.user_id IN (SELECT id FROM filtered_users)
      AND cp.updated_at >= p_start
      AND cp.updated_at <= p_end
    GROUP BY c.id, c.title
  ),
  unioned AS (
    SELECT * FROM lesson_rank
    UNION ALL
    SELECT * FROM capsula_rank
  )
  SELECT *
  FROM unioned
  ORDER BY completions DESC, starts DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_engagement_series(
  p_start timestamptz,
  p_end timestamptz,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  period date,
  dau bigint,
  lesson_completions bigint,
  capsula_completions bigint,
  quiz_attempts bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
  ),
  days AS (
    SELECT generate_series(p_start::date, p_end::date, interval '1 day')::date AS period
  ),
  activity AS (
    SELECT date_trunc('day', lp.updated_at)::date AS period, lp.user_id
    FROM public.lesson_progress lp
    WHERE lp.user_id IN (SELECT id FROM filtered_users)
      AND lp.updated_at >= p_start AND lp.updated_at <= p_end
    UNION ALL
    SELECT date_trunc('day', cp.updated_at)::date AS period, cp.user_id
    FROM public.capsula_progress cp
    WHERE cp.user_id IN (SELECT id FROM filtered_users)
      AND cp.updated_at >= p_start AND cp.updated_at <= p_end
    UNION ALL
    SELECT date_trunc('day', lue.created_at)::date AS period, lue.user_id
    FROM public.lab_usage_events lue
    WHERE lue.user_id IN (SELECT id FROM filtered_users)
      AND lue.created_at >= p_start AND lue.created_at <= p_end
  ),
  dau_grouped AS (
    SELECT a.period, COUNT(DISTINCT a.user_id)::bigint AS dau
    FROM activity a
    GROUP BY a.period
  ),
  lesson_comp AS (
    SELECT date_trunc('day', lp.data_conclusao)::date AS period, COUNT(*)::bigint AS total
    FROM public.lesson_progress lp
    WHERE lp.user_id IN (SELECT id FROM filtered_users)
      AND lp.status = 'concluido'
      AND lp.data_conclusao >= p_start AND lp.data_conclusao <= p_end
    GROUP BY 1
  ),
  caps_comp AS (
    SELECT date_trunc('day', cp.data_conclusao)::date AS period, COUNT(*)::bigint AS total
    FROM public.capsula_progress cp
    WHERE cp.user_id IN (SELECT id FROM filtered_users)
      AND cp.status = 'concluido'
      AND cp.data_conclusao >= p_start AND cp.data_conclusao <= p_end
    GROUP BY 1
  ),
  quiz_grouped AS (
    SELECT date_trunc('day', qa.started_at)::date AS period, COUNT(*)::bigint AS total
    FROM public.quiz_attempts qa
    WHERE qa.user_id IN (SELECT id FROM filtered_users)
      AND qa.started_at >= p_start AND qa.started_at <= p_end
    GROUP BY 1
  )
  SELECT
    d.period,
    COALESCE(dg.dau, 0)::bigint AS dau,
    COALESCE(lc.total, 0)::bigint AS lesson_completions,
    COALESCE(cc.total, 0)::bigint AS capsula_completions,
    COALESCE(qg.total, 0)::bigint AS quiz_attempts
  FROM days d
  LEFT JOIN dau_grouped dg ON dg.period = d.period
  LEFT JOIN lesson_comp lc ON lc.period = d.period
  LEFT JOIN caps_comp cc ON cc.period = d.period
  LEFT JOIN quiz_grouped qg ON qg.period = d.period
  ORDER BY d.period;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_lab_usage(
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer DEFAULT 10,
  p_gender text DEFAULT NULL,
  p_state_uf text DEFAULT NULL,
  p_profession text DEFAULT NULL
)
RETURNS TABLE (
  lab_id uuid,
  lab_name text,
  sessions bigint,
  unique_users bigint,
  total_time_seconds bigint,
  avg_time_seconds numeric,
  opens bigint,
  interactions bigint,
  completes bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE (p_gender IS NULL OR p.gender = p_gender)
      AND (p_state_uf IS NULL OR p.state_uf = p_state_uf)
      AND (p_profession IS NULL OR p.profession = p_profession)
  )
  SELECT
    l.id AS lab_id,
    l.title AS lab_name,
    COUNT(*) FILTER (WHERE lue.event_type = 'open')::bigint AS sessions,
    COUNT(DISTINCT lue.user_id)::bigint AS unique_users,
    COALESCE(SUM(COALESCE(lue.duration_seconds, 0)) FILTER (WHERE lue.event_type = 'close'), 0)::bigint AS total_time_seconds,
    COALESCE(ROUND(AVG(lue.duration_seconds) FILTER (WHERE lue.event_type = 'close'), 2), 0) AS avg_time_seconds,
    COUNT(*) FILTER (WHERE lue.event_type = 'open')::bigint AS opens,
    COUNT(*) FILTER (WHERE lue.event_type = 'interaction')::bigint AS interactions,
    COUNT(*) FILTER (WHERE lue.event_type = 'complete')::bigint AS completes
  FROM public.virtual_labs l
  LEFT JOIN public.lab_usage_events lue ON lue.lab_id = l.id
    AND lue.created_at >= p_start
    AND lue.created_at <= p_end
    AND lue.user_id IN (SELECT id FROM filtered_users)
  GROUP BY l.id, l.title
  ORDER BY sessions DESC, unique_users DESC
  LIMIT p_limit;
$$;
