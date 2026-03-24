-- Missão, Visão e Valores logo após a seção "Por Que a ProGenia Existe?" (ou equivalente)
-- Usa slot temporário para evitar colisão de order_index ao deslocar linhas.

DO $$
DECLARE
  after_order int;
  mvv_id uuid;
  target_slot int;
BEGIN
  SELECT aps.order_index INTO after_order
  FROM public.about_page_sections aps
  WHERE aps.title ILIKE '%Por Que%a ProGenia%'
     OR aps.title ILIKE '%Por Que ProGenia%'
  ORDER BY aps.order_index ASC
  LIMIT 1;

  IF after_order IS NULL THEN
    SELECT aps.order_index INTO after_order
    FROM public.about_page_sections aps
    WHERE aps.section_type = 'text'
      AND (aps.title ILIKE '%Por Que%' OR aps.title ILIKE '%por quê%')
    ORDER BY aps.order_index ASC
    LIMIT 1;
  END IF;

  SELECT id INTO mvv_id FROM public.about_page_sections WHERE section_type = 'mvv' LIMIT 1;

  IF mvv_id IS NULL OR after_order IS NULL THEN
    RETURN;
  END IF;

  target_slot := after_order + 1;

  IF EXISTS (
    SELECT 1 FROM public.about_page_sections
    WHERE id = mvv_id AND order_index = target_slot
  ) THEN
    RETURN;
  END IF;

  UPDATE public.about_page_sections
  SET order_index = 999999
  WHERE id = mvv_id;

  UPDATE public.about_page_sections
  SET order_index = order_index + 1
  WHERE order_index > after_order
    AND id <> mvv_id;

  UPDATE public.about_page_sections
  SET order_index = target_slot
  WHERE id = mvv_id;
END $$;
