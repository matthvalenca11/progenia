-- Remove texto+imagem legado "Por Que...ProGenia...Existe?" somente quando já há seção justification (evita página vazia se só existir o bloco antigo).
DELETE FROM public.about_page_sections t
WHERE t.section_type IN ('text_image', 'text+image')
  AND (
    t.title ILIKE '%Por Que%ProGenia%Existe%'
    OR t.title ILIKE '%Por que%ProGenia%existe%'
    OR t.title = 'Por Que ProGenia Existe?'
  )
  AND EXISTS (
    SELECT 1
    FROM public.about_page_sections j
    WHERE j.section_type = 'justification'
      AND j.id IS DISTINCT FROM t.id
  );
