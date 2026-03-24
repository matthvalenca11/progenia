-- Remove bloco legado só com título/subtítulo "Quem se Beneficia?" (sem itens em content_data)
DELETE FROM public.about_page_sections
WHERE section_type = 'stats'
  AND trim(coalesce(title, '')) = 'Quem se Beneficia?'
  AND coalesce(subtitle, '') ILIKE '%ProGenia foi desenvolvido para profissionais e estudantes da área da saúde%'
  AND (
    content_data IS NULL
    OR jsonb_typeof(content_data) <> 'array'
    OR jsonb_array_length(content_data) = 0
  );
