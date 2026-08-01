-- Contagem performática de uso de gráficos paramétricos (chartId + legado inline)

CREATE OR REPLACE FUNCTION public.get_parametric_chart_usage(p_chart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capsula_chart_id int;
  v_lesson_chart_id int;
  v_capsula_legacy_inline int;
  v_lesson_legacy_inline int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT count(*)::int
  INTO v_capsula_chart_id
  FROM public.capsulas c
  WHERE c.content_data->>'chartId' = p_chart_id::text;

  SELECT count(*)::int
  INTO v_lesson_chart_id
  FROM public.lessons l
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(l.content_data->'blocks', '[]'::jsonb)) AS block
    WHERE block->>'type' = 'dynamic_chart'
      AND block->'data'->>'chartId' = p_chart_id::text
  );

  SELECT count(*)::int
  INTO v_capsula_legacy_inline
  FROM public.capsulas c
  WHERE c.content_data ? 'dynamic_chart'
    AND COALESCE(c.content_data->>'chartId', '') = '';

  SELECT count(*)::int
  INTO v_lesson_legacy_inline
  FROM public.lessons l
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(l.content_data->'blocks', '[]'::jsonb)) AS block
    WHERE block->>'type' = 'dynamic_chart'
      AND COALESCE(block->'data'->>'chartId', '') = ''
      AND block->'data' ? 'source_type'
  );

  RETURN jsonb_build_object(
    'capsula_chart_id', v_capsula_chart_id,
    'lesson_chart_id', v_lesson_chart_id,
    'capsula_legacy_inline', v_capsula_legacy_inline,
    'lesson_legacy_inline', v_lesson_legacy_inline,
    'total',
      v_capsula_chart_id
      + v_lesson_chart_id
      + v_capsula_legacy_inline
      + v_lesson_legacy_inline
  );
END;
$$;

COMMENT ON FUNCTION public.get_parametric_chart_usage(uuid) IS
  'Admin: conta referências por chartId e blocos legados inline (dynamic_chart).';

GRANT EXECUTE ON FUNCTION public.get_parametric_chart_usage(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
