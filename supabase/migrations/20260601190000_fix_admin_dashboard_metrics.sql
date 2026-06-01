-- Corrige métricas do dashboard admin: usuários ativos, demografia e conclusões

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
  ),
  activity_users AS (
    SELECT DISTINCT lp.user_id AS id
    FROM public.lesson_progress lp
    WHERE lp.user_id IN (SELECT id FROM filtered_users)
      AND lp.updated_at >= p_start AND lp.updated_at <= p_end
    UNION
    SELECT DISTINCT cp.user_id
    FROM public.capsula_progress cp
    WHERE cp.user_id IN (SELECT id FROM filtered_users)
      AND cp.updated_at >= p_start AND cp.updated_at <= p_end
    UNION
    SELECT DISTINCT lue.user_id
    FROM public.lab_usage_events lue
    WHERE lue.user_id IN (SELECT id FROM filtered_users)
      AND lue.created_at >= p_start AND lue.created_at <= p_end
    UNION
    SELECT DISTINCT us.user_id
    FROM public.user_stats us
    WHERE us.user_id IN (SELECT id FROM filtered_users)
      AND us.last_activity_date >= p_start::date
      AND us.last_activity_date <= p_end::date
  )
  SELECT
    (SELECT COUNT(*) FROM filtered_users),
    (SELECT COUNT(*) FROM public.profiles p
      WHERE p.id IN (SELECT id FROM filtered_users)
        AND p.created_at >= p_start AND p.created_at <= p_end),
    (SELECT COUNT(*) FROM activity_users),
    (SELECT COUNT(*) FROM public.lesson_progress lp
      WHERE lp.user_id IN (SELECT id FROM filtered_users)
        AND lp.status = 'concluido'
        AND COALESCE(lp.data_conclusao, lp.updated_at) >= p_start
        AND COALESCE(lp.data_conclusao, lp.updated_at) <= p_end),
    (SELECT COUNT(*) FROM public.capsula_progress cp
      WHERE cp.user_id IN (SELECT id FROM filtered_users)
        AND cp.status = 'concluido'
        AND COALESCE(cp.data_conclusao, cp.updated_at) >= p_start
        AND COALESCE(cp.data_conclusao, cp.updated_at) <= p_end),
    COALESCE((
      SELECT AVG(val)::numeric FROM (
        SELECT lp.progress_percentage AS val
        FROM public.lesson_progress lp
        WHERE lp.user_id IN (SELECT id FROM filtered_users)
          AND lp.updated_at >= p_start AND lp.updated_at <= p_end
        UNION ALL
        SELECT cp.progress_percentage
        FROM public.capsula_progress cp
        WHERE cp.user_id IN (SELECT id FROM filtered_users)
          AND cp.updated_at >= p_start AND cp.updated_at <= p_end
      ) progress_vals
    ), 0),
    (SELECT COUNT(*) FROM public.lab_usage_events lue
      WHERE lue.user_id IN (SELECT id FROM filtered_users)
        AND lue.event_type = 'open'
        AND lue.created_at >= p_start AND lue.created_at <= p_end),
    COALESCE((
      SELECT SUM(COALESCE(lue.duration_seconds, 0))
      FROM public.lab_usage_events lue
      WHERE lue.user_id IN (SELECT id FROM filtered_users)
        AND lue.event_type = 'close'
        AND lue.created_at >= p_start AND lue.created_at <= p_end
    ), 0);
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
  SELECT 'gender'::text, COALESCE(p.gender, 'Não informado'), COUNT(*)::bigint
  FROM public.profiles p
  GROUP BY p.gender
  UNION ALL
  SELECT 'state_uf'::text, COALESCE(p.state_uf, 'Não informado'), COUNT(*)::bigint
  FROM public.profiles p
  GROUP BY p.state_uf
  UNION ALL
  SELECT 'education_level'::text, COALESCE(p.education_level, 'Não informado'), COUNT(*)::bigint
  FROM public.profiles p
  GROUP BY p.education_level
  UNION ALL
  SELECT 'profession'::text, COALESCE(p.profession, 'Não informado'), COUNT(*)::bigint
  FROM public.profiles p
  GROUP BY p.profession;
$$;
